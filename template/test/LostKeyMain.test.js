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

const T_TARGET = "D_TARGET";
const T_HEIRS = "D_HEIRS".split(",").map(extractAddress);
const T_PERCENTS = "D_PERCENTS".split(",").map(extractBN);
const T_PERIOD_SECONDS = new BN("D_PERIOD_SECONDS");

contract("LostKeyMain", ([TARGET, RECIPIENT_1, RECIPIENT_2]) => {
  let now;
  let snapshotId;
  let token;
  let lostKey;

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
    (await lastWill.targetUser()).should.be.equal(T_TARGET);

    for (let i = 0; i < T_HEIRS.length; i++) {
      const heirs = await lastWill.percents(i);
      heirs[0].should.be.equal(T_HEIRS[i]);
      heirs[1].should.be.bignumber.equal(T_PERCENTS[i]);
    }

    (await lastWill.noActivityPeriod()).should.be.bignumber.equal(T_PERIOD_SECONDS);
  });
/*
  it("#3 add contract addresses by one", async () => {
    const lastWill = await LostKey.new();

    for (let i = 0; i < 10; i++) {
      await lastWill.addTokenAddress((await TestToken.new()).address, { from: TARGET });
    }

    time.increase(time.duration.minutes(3));
    await lastWill.check();
  });

  it("#3 add contract addresses batch", async () => {
    const lastWill = await LostKey.new(TARGET, [TARGET], [100], time.duration.minutes(2));
    await lastWill.addTokenAddresses((await createTokensArray(10)).map(t => t.address));
    await lastWill.addTokenAddresses((await createTokensArray(5)).map(t => t.address));
    time.increase(time.duration.minutes(3));
    await lastWill.check();
  });

  it("#4 token distribution on check", async () => {
    const tokens = await createTokensArray(2);
    const lastWill = await LostKey.new(TARGET, [RECIPIENT_1], [100], time.duration.minutes(2));
    await lastWill.addTokenAddresses(tokens.map(t => t.address));

    for (let i = 0; i < tokens.length; i++) {
      await tokens[i].mint(TARGET, 1000);
      await tokens[i].approve(lastWill.address, 1000);
    }

    time.increase(time.duration.minutes(3));
    const tx = await lastWill.check();
    tx.logs.length.should.be.equals(5);

    tx.logs[2].event.should.be.equals("FundsSent");
    tx.logs[2].args.recipient.should.be.equals(RECIPIENT_1);
    tx.logs[2].args.amount.should.be.bignumber.equal(web3.toWei(1, "ether"));
    tx.logs[2].args.percent.should.be.bignumber.equal(100);

    tx.logs[3].event.should.be.equals("TokensSent");
    tx.logs[3].args.token.should.be.equals(tokens[0].address);
    tx.logs[3].args.recipient.should.be.equals(RECIPIENT_1);
    tx.logs[3].args.amount.should.be.bignumber.equal(1000);
    tx.logs[3].args.percent.should.be.bignumber.equal(100);

    tx.logs[4].event.should.be.equals("TokensSent");
    tx.logs[4].args.token.should.be.equals(tokens[1].address);
    tx.logs[4].args.recipient.should.be.equals(RECIPIENT_1);
    tx.logs[4].args.amount.should.be.bignumber.equal(1000);
    tx.logs[4].args.percent.should.be.bignumber.equal(100);

    (await tokens[0].balanceOf(RECIPIENT_1)).should.be.bignumber.equal(1000);
    (await tokens[1].balanceOf(RECIPIENT_1)).should.be.bignumber.equal(1000);
  });

  it("#5 token distribution to multiple addresses", async () => {
    const tokens = await Promise.all(Array(...Array(2)).map(_ => SimpleToken.new()));
    const lastWill = await LostKey.new(TARGET, [RECIPIENT_1, RECIPIENT_2], [50, 50], 2 * MINUTE);
    await lastWill.addTokenAddresses(tokens.map(t => t.address));

    await lastWill.sendTransaction({ value: web3.toWei(1, "ether") });
    await Promise.all(tokens.map(t => t.mint(lastWill.address, 1000)));

    increaseTime(3 * MINUTE);
    const tx = await lastWill.check();

    tx.logs.length.should.be.equals(8);

    tx.logs[2].event.should.be.equals("FundsSent");
    tx.logs[2].args.recipient.should.be.equals(RECIPIENT_1);
    tx.logs[2].args.amount.should.be.bignumber.equal(web3.toWei(0.5, "ether"));
    tx.logs[2].args.percent.should.be.bignumber.equal(50);

    tx.logs[3].event.should.be.equals("FundsSent");
    tx.logs[3].args.recipient.should.be.equals(RECIPIENT_2);
    tx.logs[3].args.amount.should.be.bignumber.equal(web3.toWei(0.5, "ether"));
    tx.logs[3].args.percent.should.be.bignumber.equal(50);

    tx.logs[4].event.should.be.equals("TokensSent");
    tx.logs[4].args.token.should.be.equals(tokens[0].address);
    tx.logs[4].args.recipient.should.be.equals(RECIPIENT_1);
    tx.logs[4].args.amount.should.be.bignumber.equal(500);
    tx.logs[4].args.percent.should.be.bignumber.equal(50);

    tx.logs[5].event.should.be.equals("TokensSent");
    tx.logs[5].args.token.should.be.equals(tokens[0].address);
    tx.logs[5].args.recipient.should.be.equals(RECIPIENT_2);
    tx.logs[5].args.amount.should.be.bignumber.equal(500);
    tx.logs[5].args.percent.should.be.bignumber.equal(50);

    tx.logs[6].event.should.be.equals("TokensSent");
    tx.logs[6].args.token.should.be.equals(tokens[1].address);
    tx.logs[6].args.recipient.should.be.equals(RECIPIENT_1);
    tx.logs[6].args.amount.should.be.bignumber.equal(500);
    tx.logs[6].args.percent.should.be.bignumber.equal(50);

    tx.logs[7].event.should.be.equals("TokensSent");
    tx.logs[7].args.token.should.be.equals(tokens[1].address);
    tx.logs[7].args.recipient.should.be.equals(RECIPIENT_2);
    tx.logs[7].args.amount.should.be.bignumber.equal(500);
    tx.logs[7].args.percent.should.be.bignumber.equal(50);

    (await tokens[0].balanceOf(RECIPIENT_1)).should.be.bignumber.equal(500);
    (await tokens[0].balanceOf(RECIPIENT_2)).should.be.bignumber.equal(500);
    (await tokens[1].balanceOf(RECIPIENT_1)).should.be.bignumber.equal(500);
    (await tokens[1].balanceOf(RECIPIENT_2)).should.be.bignumber.equal(500);
  });

  it("#6 token address deletion", async () => {
    const tokens = await Promise.all(Array(...Array(2)).map(_ => SimpleToken.new().then(t => t.address)));
    const lastWill = await LostKey.new(TARGET, [RECIPIENT_1], [100], 2 * MINUTE);

    await lastWill.addTokenAddresses(tokens);
    let addressesInContract = await lastWill.getTokenAddresses();
    addressesInContract[0].should.be.equals(tokens[0]);
    addressesInContract[1].should.be.equals(tokens[1]);

    await lastWill.deleteTokenAddress(tokens[0]);
    addressesInContract = await lastWill.getTokenAddresses();
    addressesInContract.length.should.be.equals(1);
    addressesInContract[0].should.be.equals(tokens[1]);

    await lastWill.addTokenAddress(tokens[0]);
    await lastWill.deleteTokenAddress(tokens[1]);
    addressesInContract = await lastWill.getTokenAddresses();
    addressesInContract.length.should.be.equals(1);
    addressesInContract[0].should.be.equals(tokens[0]);
  });

  it("#7 reject not listed erc223 tokens", async () => {
    const lastWill = await LostKey.new(TARGET, [RECIPIENT_1], [100], 2 * MINUTE);
    await increaseTime(2 * MINUTE);
    const erc223 = await SimpleERC223Token.new();
    await erc223.transfer(lastWill.address, 1000).should.eventually.be.rejected;
  });

  it("#8 apply listed erc223 tokens", async () => {
    const lastWill = await LostKey.new(TARGET, [RECIPIENT_1], [100], 2 * MINUTE);
    await increaseTime(2 * MINUTE);
    const erc223 = await SimpleERC223Token.new();
    await lastWill.addTokenAddress(erc223.address);
    await erc223.transfer(lastWill.address, 1000);
  });
  */
});
