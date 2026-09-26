// Manual mock: the real native spinner/wheel can't run under Jest. Forward every prop
// (including `onChange`) onto a bare View so tests can drive a selection via
// `fireEvent(getByTestId('dob-picker'), 'onChange', event, date)`.
const React = require('react');
const { View } = require('react-native');

function DateTimePicker(props) {
  return React.createElement(View, props);
}

module.exports = DateTimePicker;
module.exports.default = DateTimePicker;
