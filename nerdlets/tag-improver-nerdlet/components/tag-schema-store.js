import React from 'react';
import PropTypes from 'prop-types';

import { Dropdown, DropdownItem } from 'nr1';

import { getTaggingPolicyProps } from './commonUtils';

export class StorageTypeView extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    accountId: PropTypes.number,
    selectedStorageId: PropTypes.string,
    setTaggingPolicy: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.updateSelectedStorageTypeId = this.updateSelectedStorageTypeId.bind(this);
  }

  state = {
    selectedStorageId: this.props.selectedStorageId || 'SCHEMA',
    storageTypes: null
  };

  async componentDidMount() {
    const {
      taggingPolicy,
      storageTypes,
      storageId
    } = await getTaggingPolicyProps(
      this.props.selectedStorageId,
      this.props.accountId
    );
    this.setState(
      {
        storageTypes,
        selectedStorageId: storageId
      },
      () => this.props.setTaggingPolicy(taggingPolicy, storageId)
    );
  }

  async componentDidUpdate(prevProps) {
    if (prevProps.accountId !== this.props.accountId) {
      const { selectedStorageId } = this.state;
      const { storageTypes } = await getTaggingPolicyProps(
        selectedStorageId,
        this.props.accountId
      );

      this.setState({ storageTypes });
    }
  }

  async updateSelectedStorageTypeId(selectedStorageId) {
    const {
      taggingPolicy,
      storageTypes,
      storageId
    } = await getTaggingPolicyProps(selectedStorageId, this.props.accountId);

    this.setState(
      {
        storageTypes,
        selectedStorageId: storageId
      },
      () => this.props.setTaggingPolicy(taggingPolicy, storageId)
    );
  }

  render() {
    return (
      <>
        Storage Type
        <Dropdown
          style={this.props.style}
          title={this.state.selectedStorageId}
          items={this.state.storageTypes}
        >
          {({ item, index }) => (
            <DropdownItem
              key={`e-${index}`}
              onClick={() => this.updateSelectedStorageTypeId(item.id)}
            >
              {item.name}
            </DropdownItem>
          )}
        </Dropdown>
      </> //
    );
  }
}

export class StorageTypeEdit extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    accountId: PropTypes.number,
    selectedStorageId: PropTypes.string,
    setTargetStorage: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.updateSelectedStorageTypeId = this.updateSelectedStorageTypeId.bind(this);
  }

  state = {
    selectedStorageId: 'SCHEMA',
    storageTypes: null
  };

  async componentDidMount() {
    const { storageTypes, storageId } = await getTaggingPolicyProps(
      this.props.selectedStorageId,
      this.props.accountId
    );
    this.props.setTargetStorage({ storageId });
    this.setState({
      storageTypes,
      selectedStorageId: storageId
    });
  }

  updateSelectedStorageTypeId(selectedStorageId) {
    this.setState({ selectedStorageId });
    this.props.setTargetStorage({ storageId: selectedStorageId });
  }

  render() {
    return (
      <>
        Save To
        <Dropdown
          style={this.props.style}
          title={this.state.selectedStorageId}
          items={this.state.storageTypes}
        >
          {({ item, index }) => (
            <DropdownItem
              key={`e-${index}`}
              onClick={() => this.updateSelectedStorageTypeId(item.id)}
            >
              {item.name}
            </DropdownItem>
          )}
        </Dropdown>
      </> // end
    );
  }
}
