import React from "react";
import { Modal, Button } from "nr1";

export default class ModalButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      shown: false,
      mounted: false,
    };
  }

  onOpen = () =>
    this.setState({ mounted: true }, () => this.setState({ shown: true }));
  onClose = () => this.setState({ shown: false });
  onHidden = () => this.setState({ mounted: false });

  render() {
    const { style, className, children, buttonText, disabled, buttonType } = this.props;
    const { shown, mounted } = this.state;
    return (
      <>
        <Button
          className={className}
          type={buttonType}
          style={style}
          disabled={disabled}
          onClick={this.onOpen}
        >
          {buttonText}
        </Button>
        {mounted && (
          <Modal
            hidden={!shown}
            onClose={this.onClose}
            onHideEnd={this.onHidden}
          >
            {children}
          </Modal>
        )}
      </>
    );
  }
}
