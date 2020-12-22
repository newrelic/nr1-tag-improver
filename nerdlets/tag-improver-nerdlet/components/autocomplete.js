import React from 'react';
import PropTypes from 'prop-types';

import { TextField } from 'nr1';

export default class Autocomplete extends React.Component {
  static propTypes = {
    disabled: PropTypes.bool,
    onChange: PropTypes.func,
    choices: PropTypes.array,
    placeholder: PropTypes.string,
    value: PropTypes.string,
    className: PropTypes.string,
    style: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.state = {
      dropDownX: null,
      dropDownY: null,
      width: null,
      menuOpen: false,
      justPicked: false
    };
  }

  onFocusTextField = event => {
    if (this.props.disabled) return;
    const { x, y, width } = event.target.getBoundingClientRect();
    this.setState({ menuOpen: true, dropDownX: x, dropDownY: y, width });
  };

  onBlurTextField = () => {
    this.setState({ menuOpen: false });
  };

  onKeyDownTextField = event => {
    if (event.keyCode === 13) {
      this.setState({ menuOpen: false });
    }
  };

  onMouseEnterMenu = () => {
    this.menuTimer && clearTimeout(this.menuTimer);
  };

  onMouseLeaveMenu = () => {
    this.menuTimer = setTimeout(() => this.setState({ menuOpen: false }), 1000);
  };

  updateValue = (e, value, justPicked) => {
    this.setState({ justPicked });
    this.props.onChange && this.props.onChange(e, value);
  };

  render() {
    const {
      choices,
      disabled,
      placeholder,
      value,
      className,
      style
    } = this.props;
    const { menuOpen, dropDownX, dropDownY, justPicked, width } = this.state;
    const choiceEntries = Object.entries(choices).filter(
      ([, choice]) =>
        !value ||
        justPicked ||
        (choice || '').toLowerCase().includes((value || '').toLowerCase())
    );
    const showMenu = menuOpen && !!choiceEntries.length;
    return (
      <>
        <TextField
          className={className}
          style={style || {}}
          value={value}
          onChange={e => this.updateValue(e, e.currentTarget.value, false)}
          onFocus={this.onFocusTextField}
          onClick={this.onFocusTextField}
          onKeyDown={this.onKeyDownTextField}
          disabled={disabled}
          placeholder={placeholder}
        />
        {showMenu && (
          <div
            className="autocomplete-menu"
            onMouseEnter={this.onMouseEnterMenu}
            onMouseLeave={this.onMouseLeaveMenu}
            style={{ left: dropDownX, top: dropDownY + 24, width }}
          >
            {choiceEntries.map(([choiceKey, choice]) => (
              <div
                className="autocomplete-item"
                key={`autocomplete-item-${choiceKey}`}
                onClick={e => {
                  this.updateValue(e, choiceKey, true);
                  this.onBlurTextField();
                }}
              >
                {choice}
              </div>
            ))}
          </div>
        )}
      </>
    );
  }
}
