import React from 'react';
import { TextField } from 'nr1';

export default class Autocomplete extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      dropDownX: null,
      dropDownY: null,
      width: null,
      menuOpen: false,
      justPicked: false,
      menuHasMouse: false
    };
  }

  onFocusTextField = event => {
    if (this.props.disabled) return;
    const { x, y, width } = event.target.getBoundingClientRect();
    this.setState({ menuOpen: true, dropDownX: x, dropDownY: y, width });
  };

  onBlurTextField = event => {
    this.setState({ menuOpen: false, menuHasMouse: false });
  };

  onKeyDownTextField = event => {
    if (event.keyCode === 13) {
      this.setState({ menuOpen: false, menuHasMouse: false });
    }
  };

  onMouseEnterMenu = event => {
    this.setState({ menuHasMouse: true });
    this.menuTimer && clearTimeout(this.menuTimer);
  };

  onMouseLeaveMenu = event => {
    this.setState({ menuHasMouse: false }, () => {
      this.menuTimer = setTimeout(
        () => this.setState({ menuOpen: false }),
        1000
      );
    });
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
      ([choiceKey, choice]) =>
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
