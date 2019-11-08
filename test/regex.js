const constants = require('../dist/constants');

for (const dm of [
  {
    msg: '@recipient @TipDai @TipDai send @recipient_ $5 please.',
    expected: { recipient: 'recipient_', amount: '5' }
  },
  {
    msg: '@nanexcool @antiprosynth Well get there indeed.\n\nHeres a bit of testnet dai to give you a taste of a future where people might give a fuck about Dai w/out leaving the comfort of Twitter.\n\n@TipDai give @nanexcool $1 please.',
    expected: { recipient: 'nanexcool', amount: '1' }
  },
  {
    msg: '@recipient @TipDai @TipDai send @recipient $5 please.',
    expected: { recipient: 'recipient', amount: '5' }
  },
  {
    msg: '@recipient @TipDai @TipDai send @recipient $0.10 please.',
    expected: { recipient: 'recipient', amount: '0.10' }
  },
  {
    msg: '@TipDai Hi, send @recipient (not @invalid) some money: $0.101.',
    expected: { recipient: 'recipient', amount: '0.10' }
  },
  {
    msg: '@TipDai Hi, send @recipient (not @invalid) some money: $0.10.',
    expected: { recipient: 'recipient', amount: '0.10' }
  },
  {
    msg: '@TipDai Hi, send @recipient (not @invalid) some money: $0.10',
    expected: { recipient: 'recipient', amount: '0.10' }
  },
  {
    msg: '@TipDai Hi, send @recipient $0.10 and give @invalid like idk $100',
    expected: { recipient: 'recipient', amount: '0.10' }
  },
  {
    msg: '@TipDai Hi, send @recipient some money: $0.10 or else!',
    expected: { recipient: 'recipient', amount: '0.10' }
  },
  {
    msg: '@TipDai Hi, send @recipient some money: $0.10',
    expected: { recipient: 'recipient', amount: '0.10' }
  }
]) {
  const actual = dm.msg.match(constants.tipRegex('TipDai'))
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
