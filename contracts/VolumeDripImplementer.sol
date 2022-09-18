// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {VolumeDrip} from './VolumeDrip.sol';

///@author eldief
///@notice ERC20 implementation that support automated volume farming per epoch.
///@notice This allows user balance to be updated per epoch without any interaction or claim.
///@notice Shout out to 0xBeans and his DRIP20 implementation for the inspiration: https://github.com/0xBeans/DRIP20  
contract VolumeDripImplementer is VolumeDrip {

    // Example of whitelisted address.
    uint256 private _length;
    mapping(address => bool) private _whitelisted;


    constructor(
        string memory _name,
        string memory _symbol,
        uint64 _epochLength,
        uint256 _epochEmission,
        uint256 _initialSupply,
        uint64 _distributionDuration
    ) VolumeDrip (
        _name, 
        _symbol, 
        _epochLength,
        _epochEmission,
        _initialSupply,
        _distributionDuration) 
    {
        // simple example of whitelisting
        _whitelisted[msg.sender] = true;
    }

    // example function to keep track of whitelisted addresses
    function whitelisted() external view returns (uint256) {
        return _length;
    }

    // example function to test contract implementation
    function whitelist(address _address) external {
        _whitelisted[_address] = true;
        _length++;
    }

    /**
     * @notice Implements whitelisted check to VolumeDrip20._addVolume function.
     */
    function addVolume(address account, uint256 amount) external {

        // add whitelisting check before calling actual contract logic
        require(_whitelisted[msg.sender], 'Not whitelisted');

        super._addVolume(account, amount);
    }
}