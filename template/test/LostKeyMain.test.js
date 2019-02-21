const { BN, time, ether, shouldFail, expectEvent, balance } = require("openzeppelin-test-helpers");

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
    const contract = await LostKey.new();
    contract.address.should.have.length(42);
  });

  it("#2 check parameters", async () => {
    const contract = await LostKey.new();
    (await contract.targetUser()).should.be.equal(TARGET);

    for (let i = 0; i < HEIRS.length; i++) {
      const heirs = await contract.percents(i);
      heirs[0].should.be.equal(HEIRS[i]);
      heirs[1].should.be.bignumber.equal(PERCENTS[i]);
    }

    (await contract.noActivityPeriod()).should.be.bignumber.equal(PERIOD_SECONDS);
  });

  it("#3 add contract addresses by one", async () => {
    const contract = await LostKey.new();

    for (let i = 0; i < 10; i++) {
      await contract.addTokenAddress((await TestToken.new()).address, { from: TARGET });
    }
    time.increase(PERIOD_SECONDS.add(new BN(1)));
    await contract.check();
  });

  it("#4 add contract addresses batch", async () => {
    const contract = await LostKey.new();
    await contract.addTokenAddresses((await createTokensArray(10)).map(t => t.address));

    const tokens = (await createTokensArray(5)).map(t => t.address);
    const { logs } = await contract.addTokenAddresses(tokens);

    for (let i = 0; i < logs.length; i++) {
      const {
        event,
        args: { token }
      } = logs[i];
      event.should.be.equal("TokenAdded");
      token.should.be.equal(tokens[i]);
    }

    time.increase(PERIOD_SECONDS.add(new BN(1)));
    await contract.check();
  });

  it("#5 token distribution on check", async () => {
    const tokens = await createTokensArray(2);
    const contract = await LostKey.new();
    await contract.addTokenAddresses(tokens.map(t => t.address));

    const heirsCount = HEIRS_COUNT;
    const amount = new BN(1000).mul(new BN(HEIRS_COUNT));

    for (let i = 0; i < tokens.length; i++) {
      await tokens[i].mint(TARGET, amount);
      await tokens[i].approve(contract.address, amount);
    }

    time.increase(PERIOD_SECONDS.add(new BN(1)));
    const { logs } = await contract.check();

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

  // i am alive?

  // change lastTxActive after iamalive
  // check не срабатывает если не прошло еще достаточно времени
  // чек сработает если был вызван i am alive и прошло время
  // чек не сработает если был вызван i am alive и после этого время еще не прошло
  // чек не сработает если он уже сработал

  it("#6 fallback function should revert", async () => {
    const contract = await LostKey.new();
    await shouldFail.reverting(contract.sendTransaction({ value: ether("1") }));
  });

  it("#7 cannot execute contract after kill", async () => {
    const tokens = await createTokensArray(2);
    const contract = await LostKey.new();
    await contract.addTokenAddresses(tokens.map(t => t.address));

    const amount = new BN(1000).mul(new BN(HEIRS_COUNT));

    for (let i = 0; i < tokens.length; i++) {
      await tokens[i].mint(TARGET, amount);
      await tokens[i].approve(contract.address, amount);
    }

    const { logs } = await contract.kill();
    expectEvent.inLogs(logs, "Killed", { byUser: true });

    await shouldFail.reverting(contract.addTokenAddresses((await createTokensArray(1)).map(t => t.address)));
    await time.increase(PERIOD_SECONDS.add(new BN(1)));
    await shouldFail.reverting(contract.check());
  });

  it("#8 i am available", async () => {
    const tokens = await createTokensArray(2);
    const contract = await LostKey.new();
    await contract.addTokenAddresses(tokens.map(t => t.address));

    const heirsCount = HEIRS_COUNT;
    const amount = new BN(1000).mul(new BN(HEIRS_COUNT));

    for (let i = 0; i < tokens.length; i++) {
      await tokens[i].mint(TARGET, amount);
      await tokens[i].approve(contract.address, amount);
    }

    const { logs } = contract.check();
    console.info(logs)
    // for (let i = 0; i < logs.length; i++) {
    //
    // }

    // const { logs } = await contract.imAvailable();
    // expectEvent.inLogs(logs, "Notified");
  });

  // it("test fallback with service", async () => {
  //   contract = await LastWillNotify.new(accounts[1], [accounts[3], accounts[4]], [25, 75], 120, true);
  //   let time = await contract.lastActiveTs();
  //   await increaseTime(HOUR);
  //   await contract.sendTransaction({ value: "20", from: SOMEDUDE });
  //   assert.equal((await contract.lastActiveTs()).toString(), time.toString());
  //   await increaseTime(HOUR);
  //   await contract.sendTransaction({ value: "40", from: OWNER });
  //   time = await getTime();
  //   assert.equal((await contract.lastActiveTs()).toString(), time.toString());
  //   await increaseTime(HOUR);
  //   await contract.sendTransaction({ value: "40", from: TARGET });
  //   time = await getTime();
  //   assert.equal((await contract.lastActiveTs()).toString(), time.toString());
  // });
  //
  // it("test check with service", async () => {
  //   let balances = [await getBalance(accounts[3]), await getBalance(accounts[4])];
  //   await increaseTime(MINUTE);
  //   let checkFail = false;
  //   try {
  //     await contract.check({ from: SOMEDUDE });
  //   } catch (e) {
  //     checkFail = true;
  //   }
  //   assert.equal(checkFail, true);
  //   checkFail = false;
  //   try {
  //     await contract.check({ from: TARGET });
  //   } catch (e) {
  //     checkFail = true;
  //   }
  //   assert.equal(checkFail, true);
  //   await contract.check({ from: OWNER });
  //   assert.equal((await getBalance(accounts[3])).toString(), balances[0].toString());
  //   assert.equal((await getBalance(accounts[4])).toString(), balances[1].toString());
  //   await increaseTime(HOUR / 2);
  //   await contract.check({ from: OWNER });
  //   assert.equal((await getBalance(accounts[3])).toString(), balances[0].add(25).toString());
  //   assert.equal((await getBalance(accounts[4])).toString(), balances[1].add(75).toString());
  // });
});
