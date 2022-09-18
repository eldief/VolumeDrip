const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const UINT64_MAX = BigInt("18446744073709551615");

describe("Farming", () => {

    const _epochLength = 10;
    const _symbol = "VD20"
    const _name = "VolumeDripImplementer";
    const _distributionDuration = 500;
    const _1ether = ethers.utils.parseUnits("1");
    const _epochEmission = ethers.utils.parseUnits("100");
    const _initialSupply = ethers.utils.parseUnits("1000000");

    // mine new blocks
    async function mineBlocks(num) {
        if (num <= 0) {
            return;
        }
        const hexNum = "0x" + num.toString(16);
        await ethers.provider.send('hardhat_mine', [hexNum]);
    };

    function getRandomInt() {
        const random = (Math.random() + 1) * 100;
        const randomBigInt = BigInt(Math.trunc(random));
        return ethers.utils.parseUnits(randomBigInt.toString());
    }

    const deployTokenFixture = async () => {
        
        // get addresses
        const [_deployer, _account1, _account2, _account3] = await ethers.getSigners();

        // deploy contract 
        const VolumeDripImplementer = await ethers.getContractFactory("VolumeDripImplementer");
        const _volumeDripImplementer = await VolumeDripImplementer.deploy(_name, _symbol, _epochLength, _epochEmission, _initialSupply, _distributionDuration);
        await _volumeDripImplementer.deployed();
        
        // whitelist addressed to test
        await _volumeDripImplementer.whitelist(_deployer.address);
        await _volumeDripImplementer.whitelist(_account1.address);
        await _volumeDripImplementer.whitelist(_account2.address);
        await _volumeDripImplementer.whitelist(_account3.address);

        return { _volumeDripImplementer, _deployer, _account1, _account2, _account3 };
    }

    // constructor(string memory name_, string memory symbol_, uint256 _epochLength, uint256 _epochEmission, uint256 _initialSupply, uint256 _distributionDuration) Ownable()
    describe("constructor", () => {

        it("should set '_name'", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            const name = await _volumeDripImplementer.name();
            expect(name).to.equals(_name);
        });

        it("should set 'endBlock'", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            const _startBlock = await ethers.provider.getBlockNumber();
            const endBlock = await _volumeDripImplementer.endBlock();

            // whitelisting mine 1 block for each call
            const whitelisted = await _volumeDripImplementer.whitelisted();

            expect(endBlock).to.equals(_startBlock + _distributionDuration - parseInt(whitelisted));
        });

        it("should set 'startBlock'", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            const _startBlock = await ethers.provider.getBlockNumber();
            const startBlock = await _volumeDripImplementer.startBlock();

            // whitelisting mine 1 block for each call
            const whitelisted = await _volumeDripImplementer.whitelisted();

            expect(startBlock).to.equals(_startBlock - parseInt(whitelisted));
        });

        it("should set 'epochLength'", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            const epochLenght = await _volumeDripImplementer.epochLength();
            expect(epochLenght).to.equals(_epochLength);
        });

        it("should set 'epochEmission'", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            const epochEmission = await _volumeDripImplementer.epochEmission();
            expect(epochEmission).to.equals(_epochEmission);
        });

        it("should mint '_initialSupply' to owner when '_initialSupply' = 0", async () => {

            // get addresses
            const [_deployer, _account1] = await ethers.getSigners();
    
            // deploy farming 
            const VolumeDripImplementer = await ethers.getContractFactory("VolumeDripImplementer");
            const _volumeDripImplementer = await VolumeDripImplementer.deploy(_name, _symbol, _epochLength, _epochEmission, 0, _distributionDuration);
            await _volumeDripImplementer.deployed();
            const ownerSupply = await _volumeDripImplementer.balanceOf(_deployer.address);
            expect(ownerSupply).to.equals(0);
        });

        it("should mint '_initialSupply' to owner when '_initialSupply' > 0", async () => {
            const {_volumeDripImplementer, _deployer} = await loadFixture(deployTokenFixture);

            const ownerSupply = await _volumeDripImplementer.balanceOf(_deployer.address);
            expect(ownerSupply).to.equals(_initialSupply);
        });
    });

    // uint64 public endBlock
    describe("endBlock", () => {
        
        it ("should return correct 'endBlock'", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            const _startBlock = await _volumeDripImplementer.startBlock();
            const _endBlock = _distributionDuration + parseInt(_startBlock);

            const endBlock = await _volumeDripImplementer.endBlock();
            expect(endBlock).to.equals(_endBlock);
        });
    })

    // function getCurrentEpoch() public view returns (uint64)
    describe("getCurrentEpoch", () => {

        it("should return 'type(uint64).max' when emission is ended", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            await mineBlocks(_distributionDuration);

            const currentEpoch = await _volumeDripImplementer.getCurrentEpoch();
            expect(currentEpoch).to.equals(UINT64_MAX);
        });

        it("should return 'type(uint64).max' when emission is ended by 1 block", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            await mineBlocks(_distributionDuration + 1);

            const currentEpoch = await _volumeDripImplementer.getCurrentEpoch();
            expect(currentEpoch).to.equals(UINT64_MAX);
        });

        it("should return 'type(uint64).max' when emission is ended by more than a 'epochLength'", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            await mineBlocks(_distributionDuration + 1);
            await mineBlocks(_epochLength);
            await mineBlocks(_epochLength);

            const currentEpoch = await _volumeDripImplementer.getCurrentEpoch();
            expect(currentEpoch).to.equals(UINT64_MAX);
        });

        it("should return 'epoch' when emission is on going and 0 blocks are produced", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            const currentEpoch = await _volumeDripImplementer.getCurrentEpoch();
            expect(currentEpoch).to.not.equals(UINT64_MAX);
        });

        it("should return 'epoch' when emission is on going and > 0 blocks are produced", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            await mineBlocks(1);

            const currentEpoch = await _volumeDripImplementer.getCurrentEpoch();
            expect(currentEpoch).to.not.equals(UINT64_MAX);
        });

        it("should return 0 when in first 'epoch'", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);
            
            const currentEpoch = await _volumeDripImplementer.getCurrentEpoch();
            expect(currentEpoch).to.equals(0);
        });

        it("should return 0 when 'epochLength - 1' blocks are produced", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            // whitelisting mine 1 block for each call
            const whitelisted = await _volumeDripImplementer.whitelisted();

            await mineBlocks(_epochLength - 1 - parseInt(whitelisted));

            const currentEpoch = await _volumeDripImplementer.getCurrentEpoch();
            expect(currentEpoch).to.equals(0);
        });

        it("should return 1 when in second 'epoch'", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            await mineBlocks(_epochLength);

            const currentEpoch = await _volumeDripImplementer.getCurrentEpoch();
            expect(currentEpoch).to.equals(1);
        });

        it("should return 'epochs - 1' when in last 'epoch'", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            const epochs = await _volumeDripImplementer.getEpochs();
            const epochsMinus1 = epochs - 1;
            await mineBlocks(_epochLength * epochsMinus1);

            const currentEpoch = await _volumeDripImplementer.getCurrentEpoch();
            expect(currentEpoch).to.equals(epochsMinus1);
        });
    });

    // function getEpochs() public view returns (uint64)
    describe("getEpochs", () => {

        it ("should return number of epochs", async () => {
            const {_volumeDripImplementer} = await loadFixture(deployTokenFixture);

            const startBlock = await _volumeDripImplementer.startBlock();
            const endBlock = await _volumeDripImplementer.endBlock();

            const epochsCalculated = Math.trunc((parseInt(endBlock) - parseInt(startBlock)) / _epochLength);
            const epochs = await _volumeDripImplementer.getEpochs();

            expect(epochs).to.equals(epochsCalculated);
        });
    });

    // function addVolume(address account, uint256 amount) external
    describe("addVolume", () => {

        it("should not increase balance when amount = 0", async () => {
            const {_volumeDripImplementer, _account1} = await loadFixture(deployTokenFixture);

            const _epochs = await _volumeDripImplementer.getEpochs();
            for (let i = 0; i < _epochs + 1; ++i) {
                await _volumeDripImplementer.addVolume(_account1.address, 0);
                await mineBlocks(_epochLength - 1); // addVolume advance 1 block
            }

            const epoch = await _volumeDripImplementer.getCurrentEpoch();
            expect(epoch).to.eq(UINT64_MAX);

            const balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
            expect(balanceOf).to.eq(0);
        });

    });

    // function balanceOf(address account) public view virtual override returns (uint256) 
    describe("balanceOf", () => {

        describe("1 account", () => {

            it("should return 0 when 'account' has no volume and 0 epochs are gone", async () => {
                const {_volumeDripImplementer, _account1} = await loadFixture(deployTokenFixture);
    
                const _epochs = 1;
                for (let i = 0; i < _epochs; ++i) {
                    await mineBlocks(_epochLength);
                }
    
                const balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.equals(0);
            });
    
            it("should return epoch emission when 'account' is the only volume in 1 epoch", async () => {
                const {_volumeDripImplementer, _account1} = await loadFixture(deployTokenFixture);
    
                const _epochs = 1;
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    await mineBlocks(_epochLength - 1); // addVolume advance 1 block
                }
    
                const epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(1);
    
                const balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.equals(_epochEmission);
            });
    
            it("should return epochEmission * 2 when 'account' is the only volume in 2 epochs", async () => {
                const {_volumeDripImplementer, _account1} = await loadFixture(deployTokenFixture);
    
                const _epochs = 2;
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    await mineBlocks(_epochLength - 1); // addVolume advance 1 block
                }
                
                const epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(2);
    
                const balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.equals(BigInt(_epochEmission * 2));
            });
    
            it("should return '_epochEmission * (_epochs - 1)' when 'account' is the only volume in all epochs but one", async () => {
                const {_volumeDripImplementer, _account1} = await loadFixture(deployTokenFixture);
    
                const _epochs = await _volumeDripImplementer.getEpochs();
                for (let i = 0; i < _epochs - 1; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    await mineBlocks(_epochLength - 1); // addVolume advance 1 block
                }
    
                let epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(BigInt(_epochs - 1));
                
                const balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.equals(BigInt(_epochEmission * (_epochs - 1)));
            }).timeout(0);

            it("should return '_epochEmission * (_epochs - 1)' when 'account' is the only volume in all epochs and emission is not over", async () => {
                const {_volumeDripImplementer, _account1} = await loadFixture(deployTokenFixture);
    
                const _epochs = await _volumeDripImplementer.getEpochs();
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    if (i == 0) { 

                        // whitelisting mine 1 block for each call
                        const whitelisted = await _volumeDripImplementer.whitelisted();

                        await mineBlocks(_epochLength - 1 - parseInt(whitelisted)); // addVolume advance 1 block
                    }
                    else if (i < _epochs - 1) {
                        await mineBlocks(_epochLength - 1); // addVolume advance 1 block
                    }
                    else {
                        await mineBlocks(_epochLength - 2); // addVolume advance 1 block
                    }
                }
    
                epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(BigInt(_epochs - 1));
    
                const balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.equals(BigInt(_epochEmission * (_epochs - 1)));
            }).timeout(0);

            it("should return 'emitted' when 'account' is the only volume in all epochs and emission is over", async () => {
                const {_volumeDripImplementer, _account1} = await loadFixture(deployTokenFixture);
    
                const _epochs = await _volumeDripImplementer.getEpochs();
                for (let i = 0; i < _epochs + 1; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    await mineBlocks(_epochLength - 1); // addVolume advance 1 block
                }
    
                epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(UINT64_MAX);
    
                const balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.equals(BigInt(_epochEmission * _epochs));
            }).timeout(0);
        });

        describe("2 accounts", () => {

            it("should return 0 for 2 accounts when they have no volume and 0 epochs are gone", async () => {
                const {_volumeDripImplementer, _account1, _account2} = await loadFixture(deployTokenFixture);
    
                const _epochs = 1;
                for (let i = 0; i < _epochs; ++i) {
                    await mineBlocks(_epochLength);
                }
    
                let balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.equals(0);
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account2.address);
                expect(balanceOf).to.equals(0);
            });
    
            it("should return 'epochEmission / 2' for 2 accounts when they have volume in first epoch", async () => {
                const {_volumeDripImplementer, _account1, _account2} = await loadFixture(deployTokenFixture);
    
                const _epochs = 1;
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    await _volumeDripImplementer.addVolume(_account2.address, _1ether);
                    await mineBlocks(_epochLength - 2); // addVolume advance 1 block
                }
    
                const epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(1);
    
                let balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission / 2 * 0.99), BigInt(_epochEmission / 2 * 1.01));
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account2.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission / 2 * 0.99), BigInt(_epochEmission / 2 * 1.01));
            });
    
            it("should return 'epochEmission' for 2 accounts when they have volume in 2 epochs", async () => {
                const {_volumeDripImplementer, _account1, _account2} = await loadFixture(deployTokenFixture);
    
                const _epochs = 2;
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    await _volumeDripImplementer.addVolume(_account2.address, _1ether);
                    await mineBlocks(_epochLength - 2); // addVolume advance 1 block
                }
                
                const epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(2);
    
                let balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission * 0.99), BigInt(_epochEmission * 1.01));
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account2.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission * 0.99), BigInt(_epochEmission * 1.01));
            });
    
            it("should return 'epochEmission / 2 * 3' for 2 accounts when they have volume in 3 epochs", async () => {
                const {_volumeDripImplementer, _account1, _account2} = await loadFixture(deployTokenFixture);
    
                const _epochs = 3;
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    await _volumeDripImplementer.addVolume(_account2.address, _1ether);
                    await mineBlocks(_epochLength - 2); // addVolume advance 1 block
                }
    
                const epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(3);
    
                let balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission / 2 * 3 * 0.99), BigInt(_epochEmission / 2 * 3 * 1.01));
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account2.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission / 2 * 3 * 0.99), BigInt(_epochEmission / 2 * 3 * 1.01));
            });
    
            it("should return 'epochEmission / 2 * epochs' for 2 accounts when they have volume in every epochs", async () => {
                const {_volumeDripImplementer, _account1, _account2} = await loadFixture(deployTokenFixture);
    
                const _epochs = await _volumeDripImplementer.getEpochs();
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    await _volumeDripImplementer.addVolume(_account2.address, _1ether);
                    await mineBlocks(_epochLength - 2); // addVolume advance 1 block
                }
    
                let currentEpoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(currentEpoch).to.eq(UINT64_MAX);
                
                let balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission / 2 * _epochs * 0.99), BigInt(_epochEmission / 2 * _epochs * 1.01));
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account2.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission / 2 * _epochs * 0.99), BigInt(_epochEmission / 2 * _epochs * 1.01));
            }).timeout(0);
        });

        describe("3 accounts", () => {

            it("should return 0 for 3 accounts when they have no volume and 0 epochs are gone", async () => {
                const {_volumeDripImplementer, _account1, _account2, _account3} = await loadFixture(deployTokenFixture);
    
                const _epochs = 1;
                for (let i = 0; i < _epochs; ++i) {
                    await mineBlocks(_epochLength);
                }
    
                let balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.equals(0);
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account2.address);
                expect(balanceOf).to.equals(0);
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account3.address);
                expect(balanceOf).to.equals(0);
            });

            it("should return epochEmission / 3 for 3 accounts when they have volume in first epoch", async () => {
                const {_volumeDripImplementer, _account1, _account2, _account3} = await loadFixture(deployTokenFixture);
    
                const _epochs = 1;
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    await _volumeDripImplementer.addVolume(_account2.address, _1ether);
                    await _volumeDripImplementer.addVolume(_account3.address, _1ether);
                    await mineBlocks(_epochLength - 3); // addVolume advance 1 block
                }
    
                const epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(1);
    
                let balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission / 3 * 0.99), BigInt(_epochEmission / 3 * 1.01));
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account2.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission / 3 * 0.99), BigInt(_epochEmission / 3 * 1.01));
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account3.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission / 3 * 0.99), BigInt(_epochEmission / 3 * 1.01));
            });
    
            it("should return 'epochEmission * 2 / 3' for 3 accounts when they have volume in 2 epochs", async () => {
                const {_volumeDripImplementer, _account1, _account2, _account3} = await loadFixture(deployTokenFixture);
    
                const _epochs = 2;
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    await _volumeDripImplementer.addVolume(_account2.address, _1ether);
                    await _volumeDripImplementer.addVolume(_account3.address, _1ether);
                    await mineBlocks(_epochLength - 3); // addVolume advance 1 block
                }
                
                const epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(2);
    
                let balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission * _epochs / 3 * 0.99), BigInt(_epochEmission * _epochs / 3 * 1.01));
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account2.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission * _epochs  / 3 * 0.99), BigInt(_epochEmission * _epochs / 3 * 1.01));
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account3.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission * _epochs  / 3 * 0.99), BigInt(_epochEmission * _epochs / 3 * 1.01));
            });
    
            it("should return 'epochEmission' for 3 accounts when they have volume in 3 epochs", async () => {
                const {_volumeDripImplementer, _account1, _account2, _account3} = await loadFixture(deployTokenFixture);
    
                const _epochs = 3;
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    await _volumeDripImplementer.addVolume(_account2.address, _1ether);
                    await _volumeDripImplementer.addVolume(_account3.address, _1ether);
                    await mineBlocks(_epochLength - 3); // addVolume advance 1 block
                }
                
                const epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(3);
    
                let balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission * _epochs / 3 * 0.99), BigInt(_epochEmission * _epochs / 3 * 1.01));
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account2.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission * _epochs / 3 * 0.99), BigInt(_epochEmission * _epochs / 3 * 1.01));
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account3.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission * _epochs / 3 * 0.99), BigInt(_epochEmission * _epochs / 3 * 1.01));
            });
    
            it("should return total emission / 3 for 3 accounts when they have volume in every epochs", async () => {
                const {_volumeDripImplementer, _account1, _account2, _account3} = await loadFixture(deployTokenFixture);
    
                const _epochs = await _volumeDripImplementer.getEpochs();
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                    await _volumeDripImplementer.addVolume(_account2.address, _1ether);
                    await _volumeDripImplementer.addVolume(_account3.address, _1ether);
                    await mineBlocks(_epochLength - 3); // addVolume advance 1 block
                }
    
                let epochs = await _volumeDripImplementer.getCurrentEpoch();
                expect(epochs).to.eq(UINT64_MAX);
    
                let balanceOf = await _volumeDripImplementer.balanceOf(_account1.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission / 3 * _epochs * 0.99), BigInt(_epochEmission / 3 * _epochs * 1.01));
    
                balanceOf = await _volumeDripImplementer.balanceOf(_account2.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission / 3 * _epochs * 0.99), BigInt(_epochEmission / 3 * _epochs * 1.01));
                
                balanceOf = await _volumeDripImplementer.balanceOf(_account3.address);
                expect(balanceOf).to.be.within(BigInt(_epochEmission / 3 * _epochs * 0.99), BigInt(_epochEmission / 3 * _epochs * 1.01));
            }).timeout(0);
        });

        describe("2 accounts with different sizes", () => {

            it("should return 0 for 2 accounts when they have volume in first epoch", async () => {
                const {_volumeDripImplementer, _account1, _account2} = await loadFixture(deployTokenFixture);
    
                const _epochs = 1;
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, getRandomInt());
                    await _volumeDripImplementer.addVolume(_account2.address, getRandomInt());
                    await mineBlocks(_epochLength - 2); // addVolume advance 1 block
                }
    
                const epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(1);
    
                const balanceOf1 = await _volumeDripImplementer.balanceOf(_account1.address);
                const balanceOf2 = await _volumeDripImplementer.balanceOf(_account2.address);
                
                expect(balanceOf1).to.be.not.eq(balanceOf2)
                expect(BigInt(balanceOf1) + BigInt(balanceOf2)).to.be.within(BigInt(_epochEmission * _epochs * 0.99), BigInt(_epochEmission  * _epochs * 1.01));
            });
    
            it("should return correct balance for 2 accounts when they have different volume in 2 epochs", async () => {
                const {_volumeDripImplementer, _account1, _account2} = await loadFixture(deployTokenFixture);
    
                const _epochs = 2;
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, getRandomInt());
                    await _volumeDripImplementer.addVolume(_account2.address, getRandomInt());
                    await mineBlocks(_epochLength - 2); // addVolume advance 1 block
                }
                
                const epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(2);
    
                const balanceOf1 = await _volumeDripImplementer.balanceOf(_account1.address);
                const balanceOf2 = await _volumeDripImplementer.balanceOf(_account2.address);
        
                expect(balanceOf1).to.be.not.eq(balanceOf2)
                expect(BigInt(balanceOf1) + BigInt(balanceOf2)).to.be.within(BigInt(_epochEmission * _epochs * 0.99), BigInt(_epochEmission  * _epochs * 1.01));
            });

            it("should return correct balance for 2 accounts when they have different volume in 3 epochs", async () => {
                const {_volumeDripImplementer, _account1, _account2} = await loadFixture(deployTokenFixture);

                const _epochs = 3;
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, getRandomInt());
                    await _volumeDripImplementer.addVolume(_account2.address, getRandomInt());
                    await mineBlocks(_epochLength - 2); // addVolume advance 1 block
                }
    
                const epoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(epoch).to.eq(3);
                
                const balanceOf1 = await _volumeDripImplementer.balanceOf(_account1.address);
                const balanceOf2 = await _volumeDripImplementer.balanceOf(_account2.address);
                
                expect(balanceOf1).to.be.not.eq(balanceOf2)
                expect(BigInt(balanceOf1) + BigInt(balanceOf2)).to.be.within(BigInt(_epochEmission * _epochs * 0.99), BigInt(_epochEmission  * _epochs * 1.01));
            });

            it("should return correct balance for 2 accounts when they have different volume in every epochs", async () => {
                const {_volumeDripImplementer, _account1, _account2} = await loadFixture(deployTokenFixture);
    
                const _epochs = await _volumeDripImplementer.getEpochs();
                for (let i = 0; i < _epochs; ++i) {
                    await _volumeDripImplementer.addVolume(_account1.address, getRandomInt());
                    await _volumeDripImplementer.addVolume(_account2.address, getRandomInt());
                    await mineBlocks(_epochLength - 2); // addVolume advance 1 block
                }

                const endEpoch = await _volumeDripImplementer.getCurrentEpoch();
                expect(endEpoch).to.eq(UINT64_MAX);
    
                const balanceOf1 = await _volumeDripImplementer.balanceOf(_account1.address);
                const balanceOf2 = await _volumeDripImplementer.balanceOf(_account2.address);
                
                expect(balanceOf1).to.be.not.eq(balanceOf2)
                expect(BigInt(balanceOf1) + BigInt(balanceOf2)).to.be.within(BigInt(_epochEmission * _epochs * 0.99), BigInt(_epochEmission  * _epochs * 1.01));
            }).timeout(0);
        });        
    });

    // function transfer(address to, uint256 amount) public virtual returns (bool)
    describe("transfer", () => {

        it("should transfer token", async () => {
            const {_volumeDripImplementer, _account1} = await loadFixture(deployTokenFixture);
            
            await _volumeDripImplementer.transfer(_account1.address, _initialSupply);

            const balance = await _volumeDripImplementer.balanceOf(_account1.address);
            expect(balance).to.be.equals(_initialSupply);
        });

        it("should increase total supply when emission is on going", async () => {
            const {_volumeDripImplementer, _account1} = await loadFixture(deployTokenFixture);
              
            const _epochs = await _volumeDripImplementer.getEpochs();
            for (let i = 0; i < _epochs; ++i) {
                await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                await mineBlocks(_epochLength - 1); // addVolume advance 1 block
            }
            const prevTotalSupply = await _volumeDripImplementer.totalSupply();
            await _volumeDripImplementer.connect(_account1).transfer(_account1.address, 0);

            const postTotalSupply = await _volumeDripImplementer.totalSupply();
            expect(prevTotalSupply).to.be.lessThan(postTotalSupply);
        });
        
        it("measuring gas usage", async () => {
            const {_volumeDripImplementer, _account1} = await loadFixture(deployTokenFixture);
              
            const _epochs = await _volumeDripImplementer.getEpochs();
            for (let i = 0; i < _epochs; ++i) {
                await _volumeDripImplementer.addVolume(_account1.address, _1ether);
                await _volumeDripImplementer.transfer(_account1.address, _epochEmission);
                await mineBlocks(_epochLength - 2); // addVolume advance 1 block
            }
        });
    });
});