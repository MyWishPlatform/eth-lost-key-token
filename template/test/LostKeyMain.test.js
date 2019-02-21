const { BN, time } = require("openzeppelin-test-helpers");

const { promisify } = require("util");

function snapshot() {
  return promisify(web3.currentProvider.send)({
    jsonrpc: "2.0",
    method: "evm_snapshot"
  });
}

function revert(id) {
  return promisify(web3.currentProvider.send)({
    jsonrpc: "2.0",
    method: "evm_revert",
    params: [id]
  });
}

function createTokensArray(count) {
  return Promise.all([...Array(count)].map(_ => TestToken.new()));
}

const LostKey = artifacts.require("LostKeyMain");
const ERC20 = artifacts.require("ERC20");
const TestToken = artifacts.require("TestToken");

const MINUTE = 60;

const extractAddress = string => string.match(/\((0x\w+)\)/)[1];
const extractBN = string => new BN(string.match(/\((\d+)\)/)[1]);

const TARGET = "D_TARGET";
const HEIRS_COUNT = D_HEIRS_COUNT;
const HEIRS = "D_HEIRS".split(",").map(extractAddress);
const PERCENTS = "D_PERCENTS".split(",").map(extractBN);
const PERIOD_SECONDS = new BN("D_PERIOD_SECONDS");

contract("LostKeyMain", accounts => {
  let now;
  let snapshotId;

  beforeEach(async () => {
    snapshotId = (await snapshot()).result;
    now = await time.latest();
  });

  afterEach(async () => {
    await revert(snapshotId);
  });

  it("#1 construct", async () => {
    const lastWill = await LostKey.new();
    lastWill.address.should.have.length(42);
  });

  it("#2 check parameters", async () => {
    const lastWill = await LostKey.new();
    (await lastWill.targetUser()).should.be.equal(TARGET);

    for (let i = 0; i < HEIRS.length; i++) {
      const heirs = await lastWill.percents(i);
      heirs[0].should.be.equal(HEIRS[i]);
      heirs[1].should.be.bignumber.equal(PERCENTS[i]);
    }

    (await lastWill.noActivityPeriod()).should.be.bignumber.equal(PERIOD_SECONDS);
  });

  it("#3 add contract addresses by one", async () => {
    const lastWill = await LostKey.new();

    for (let i = 0; i < 10; i++) {
      await lastWill.addTokenAddress((await TestToken.new()).address, { from: TARGET });
    }
    time.increase(PERIOD_SECONDS.add(new BN(1)));
    await lastWill.check();
  });

  it("#4 add contract addresses batch", async () => {
    const lastWill = await LostKey.new();
    await lastWill.addTokenAddresses((await createTokensArray(10)).map(t => t.address));

    const tokens = (await createTokensArray(5)).map(t => t.address);
    const { logs } = await lastWill.addTokenAddresses(tokens);

    for (let i = 0; i < logs.length; i++) {
      const {
        event,
        args: { token }
      } = logs[i];
      event.should.be.equal("TokenAdded");
      token.should.be.equal(tokens[i]);
    }

    time.increase(PERIOD_SECONDS.add(new BN(1)));
    await lastWill.check();
  });

  it("#5 token distribution on check", async () => {
    const tokens = await createTokensArray(2);
    const lastWill = await LostKey.new();
    await lastWill.addTokenAddresses(tokens.map(t => t.address));

    const heirsCount = HEIRS_COUNT;
    const amount = new BN(1000).mul(new BN(HEIRS_COUNT));

    for (let i = 0; i < tokens.length; i++) {
      await tokens[i].mint(TARGET, amount);
      await tokens[i].approve(lastWill.address, amount);
    }

    time.increase(PERIOD_SECONDS.add(new BN(1)));
    const { logs } = await lastWill.check();

    for (let t = 0; t < tokens.length; t++) {
      for (let h = 0; h < heirsCount; h++) {
        const heirTokenAmount = amount.mul(PERCENTS[h]).div(new BN(100));
        const { event, args } = logs[t * heirsCount + 2 + h];
        event.should.be.equal("TokensSent");
        args.token.should.be.equal(tokens[t].address);
        args.recipient.should.be.equal(HEIRS[h]);
        args.percent.should.be.bignumber.equal(PERCENTS[h]);
        args.amount.should.be.bignumber.equal(heirTokenAmount);
        (await tokens[t].balanceOf(HEIRS[h])).should.be.bignumber.equal(heirTokenAmount);
      }
    }
  });
});
