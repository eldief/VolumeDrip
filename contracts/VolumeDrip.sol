// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

///@author eldief
///@notice ERC20 abstract that support automated volume farming per epoch.
///@notice This allows user balances to be updated per epoch without any interaction or claim.
///@notice Shout out to 0xBeans and his DRIP20 implementation for the inspiration: https://github.com/0xBeans/DRIP20  
abstract contract VolumeDrip is IERC20 {

    event VolumeAdded(address indexed account, uint256 indexed amount, uint64 indexed epoch);

    // Contains epoch number and volume
    struct EpochData {
        uint64 number;
        uint256 volume;
    }
    
    string public name;                         // ERC20 name
    string public symbol;                       // ERC20 symbol
    uint64 public endBlock;                     // End distribution block
    uint64 public startBlock;                   // Start distribution block
    uint64 public immutable epochLength;        // Epoch lenght in blocks
    
    uint256 private _totalSupply;               // ERC20 total supply
    uint256 public immutable epochEmission;     // Supply distributed per epoch

    // ERC20 account balance
    mapping(address => uint256) private _balances;

    // ERC20 allowance
    mapping(address => mapping(address => uint256)) private _allowances;

    // Mapping from account to epoch number and volume
    mapping(address => EpochData) private epochData;

    // Mapping from epoch to volume
    mapping(uint256 => uint256) private totalVolumes;

    constructor(
        string memory _name,
        string memory _symbol,
        uint64 _epochLength,
        uint256 _epochEmission,
        uint256 _initialSupply,
        uint64 _distributionDuration
    ) {
        require(_epochLength > 0, "Epoch length must be greater than 0");
        require(_epochEmission > 0, "Epoch emission must be greater than 0");
        require(_distributionDuration > 0, "Distribution duration must be greater than 0");

        name = _name;
        symbol = _symbol;
        epochLength = _epochLength;
        epochEmission = _epochEmission;
        startBlock = uint64(block.number);
        endBlock = startBlock + _distributionDuration;

        _mint(msg.sender, _initialSupply);
    }

    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function transfer(address to, uint256 amount) public virtual returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public virtual returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        _approve(msg.sender, spender, allowance(msg.sender, spender) + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        uint256 currentAllowance = allowance(msg.sender, spender);
        require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
        unchecked {
            _approve(msg.sender, spender, currentAllowance - subtractedValue);
        }

        return true;
    }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);

        _afterTokenTransfer(address(0), account, amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    /**
     * @notice Standard ERC20 _transfer implementation with added previous emission.
     */
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account] + _getPrevEmitted(account);
    }

    /**
     * @notice Standard ERC20 _transfer implementation with added previous emission.
     * @dev Resets previous emission volume if stored epoch is over.
     */
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(from, to, amount);

        // stored epoch is over
        //  1) reset prev epoch volume to 0 
        //  2) increase total supply
        uint256 prevEmitted = _getPrevEmitted(from);
        if (prevEmitted > 0) {
            epochData[from].volume = 0;
            _totalSupply += prevEmitted;
        }

        // include prev epoch emission in account balance
        uint256 fromBalance = _balances[from] + prevEmitted;
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");

        unchecked {
            _balances[from] = fromBalance - amount;
        }
        _balances[to] += amount;

        emit Transfer(from, to, amount);

        _afterTokenTransfer(from, to, amount);
    }

    /**
     * @notice Standard ERC20 _burn implementation with added previous emission.
     * @dev Resets previous emission volume if stored epoch is over.
     */
    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        // stored epoch is over
        //  1) reset prev epoch volume to 0 
        //  2) increase total supply
        uint256 prevEmitted = _getPrevEmitted(account);
        if (prevEmitted > 0) {
            epochData[account].volume = 0;
            _totalSupply += prevEmitted;
        }

        // include prev epoch emission in account balance
        uint256 accountBalance = _balances[account] + prevEmitted;
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");

        unchecked {
           _balances[account] = accountBalance - amount;
        }
        _totalSupply -= amount;

        emit Transfer(account, address(0), amount);

        _afterTokenTransfer(account, address(0), amount);
    }

    /**
     * @notice Get current epoch number, starting index is 0.
     * @dev Returns type(uint64).max when emission is over.
     * @return uint64 current epoch
     */
    function getCurrentEpoch() public virtual view returns (uint64) {
        uint64 blockNumber = uint64(block.number); 
        if (blockNumber >= endBlock) {
            return type(uint64).max;   
        }
        unchecked {
            return (blockNumber - startBlock) / epochLength;            
        }
    }

    /**
     * @notice Get epochs number, starting index is 1.
     * @return uint64 total number of epochs
     */
    function getEpochs() external virtual view returns (uint64) {
        unchecked {
            return (endBlock - startBlock) / epochLength;            
        }
    }

    /**
     * @notice Add transacted volume, ignored if emission is paused.
     * @dev Updates epoch user volume and total volume if emission is not over.
     * @dev Must be overridden to grant access authorized contracts.
     * @param account address to be updated
     * @param amount amount transacted by address
     */
    function _addVolume(address account, uint256 amount) internal virtual {

        // get epoch
        uint64 currentEpoch = getCurrentEpoch();

        // ignore total volume if emission is over
        if (currentEpoch != type(uint64).max) {
            totalVolumes[currentEpoch] += amount;
        }

        // store epoch number and volume to use for calculations later
        EpochData storage accountEpoch = epochData[account];
        uint64 prevNumber = accountEpoch.number;
        uint256 prevVolume = accountEpoch.volume;

        // stored epoch is over
        //  1) set new epoch volume and number
        //  2) calculate emission
        //  2) update total supply with calculated emission
        //  3) update balance with calculated emission
        if (currentEpoch > prevNumber) {
            accountEpoch.volume = amount;
            accountEpoch.number = currentEpoch;

            uint256 emissionToAccount = _getEpochEmission(prevVolume, prevNumber);
            _totalSupply += emissionToAccount;
            _balances[account] += emissionToAccount;
        }

        // stored epoch is currently on going, ignore if emission is over
        //  1) increase volume with amount
        else if (currentEpoch == prevNumber && currentEpoch != type(uint64).max) {
            accountEpoch.volume += amount;
        }

        // emit event
        emit VolumeAdded(account, amount, currentEpoch);
    }

    /**
     * @notice Get previous active epoch emission.
     * @dev Returns 0 if stored epoch is not over.
     * @param account address
     * @return uint256 previous epoch emission
     */
    function _getPrevEmitted(address account) private view returns (uint256) {
        uint64 currentEpoch = getCurrentEpoch();
        EpochData memory accountEpoch = epochData[account];

        // stored epoch is over
        if (currentEpoch > accountEpoch.number) {
            return _getEpochEmission(accountEpoch.volume, accountEpoch.number);
        }

        // do not compute current epoch rewards
        return 0;
    }

    /**
     * @notice Compute epoch emission.
     * @param accountVolume volume in epoch
     * @param epochNumber epoch number
     * @return uint256 emission amount
     */
    function _getEpochEmission(uint256 accountVolume, uint64 epochNumber) private view returns (uint256) {
        uint256 totalVolume = totalVolumes[epochNumber];
        if (totalVolume == 0 || accountVolume == 0) {
            return 0;
        }
        return accountVolume * epochEmission / totalVolume;
    }
}