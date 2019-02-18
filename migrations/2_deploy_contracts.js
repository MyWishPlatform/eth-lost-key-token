const LostKey = artifacts.require("LostKeyNotify");

module.exports = (deployer, _, [__, owner, recipient1, recipient2]) => {
  deployer.deploy(LostKey, owner, [recipient1, recipient2], [25, 75], 120);
};
