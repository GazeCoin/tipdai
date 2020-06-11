const constants = require('../dist/constants');

for (const dm of [
  {
    msg: '@recipient @TipDai @TipDai send @recipient_ $5 please. #TipDai',
    expected: { recipient: 'recipient_', amount: '5' }
  },
  {
    msg: '@recipient @TipDai @TipDai send @recipient $5 please. #TipDai',
    expected: { recipient: 'recipient', amount: '5' }
  },
  {
    msg: '@recipient @TipDai @TipDai send @recipient $0.10 please.#TipDai',
    expected: { recipient: 'recipient', amount: '0.10' }
  },
  {
    msg: '@TipDai Hi, send @recipient (not @invalid) some money: $0.101.#TipDai',
    expected: { recipient: 'recipient', amount: '0.10' }
  },
  {
    msg: '@TipDai Hi, send @recipient (not @invalid) some money: $0.10.  #TipDai',
    expected: { recipient: 'recipient', amount: '0.10' }
  },
  {
    msg: '@TipDai Hi, send @recipient (not @invalid) some money: $0.10#TipDai',
    expected: { recipient: 'recipient', amount: '0.10' }
  },
  {
    msg: '@TipDai Hi, send @recipient $0.10 and give @invalid like idk $100.#TipDai',
    expected: { recipient: 'recipient', amount: '0.10' }
  },
  {
    msg: '@TipDai Hi, send @recipient some money: $0.10 or else! #TipDai',
    expected: { recipient: 'recipient', amount: '0.10' }
  },
  {
    msg: '@TipDai Hi, send @recipient some money: $0.10.. #TipDai',
    expected: { recipient: 'recipient', amount: '0.10' }
  }
]) {
  const regx = constants.tipRegex('TipDai');
  //console.log(`regx: ${regx}`);
  const actual = dm.msg.match(regx);
  if (!actual || !actual[2]) {
    throw new Error(`Expected a match for "${dm.msg}" but got ${JSON.stringify(actual)}`);
  }
  if (actual[1] !== dm.expected.recipient) {
    throw new Error(`Expected ${dm.expected.recipient} to match ${actual[1]}`);
  }
  if (actual[2] !== dm.expected.amount) {
    throw new Error(`Expected "${dm.expected.amount}" to match "${actual[2]}"`);
  }
}

console.log(`Regex tests Passed :)`);
