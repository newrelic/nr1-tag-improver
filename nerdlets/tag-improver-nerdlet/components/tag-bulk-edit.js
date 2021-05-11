import React from 'react';
import PropTypes from 'prop-types';

import {
  HeadingText,
  PlatformStateContext,
  Button,
  Select,
  logger,
  SelectItem,
  Spinner
} from 'nr1';
import Autocomplete from './autocomplete';
import { addTags, deleteTagValues } from './commonUtils';

const ENTITY_UPDATE_STATUS = {
  NONE: 0,
  ADDING: 1,
  ADD_ERROR: 2,
  REMOVING: 3,
  REMOVE_ERROR: 4,
  SUCCESS: 5
};

export default class TagBulkEdit extends React.Component {
  static propTypes = {
    selectedEntityIds: PropTypes.array,
    tagHierarchy: PropTypes.object,
    entityTagsMap: PropTypes.object,
    reloadTagsFn: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.state = {
      selectedCurrentTag: '',
      selectedCurrentTagValue: '',
      selectedNewTagValue: '',
      entityStatuses: {},
      enableSpinner: true
    };
  }

  componentDidMount() {
    this.setState({ enableSpinner: false });
  }

  static contextType = PlatformStateContext;

  enableSpinner = enable => {
    this.setState({ enableSpinner: enable });
  };

  applyChangeValueToEntities = async () => {
    const { selectedEntityIds, entityTagsMap } = this.props;
    const {
      selectedCurrentTag,
      selectedCurrentTagValue,
      selectedNewTagValue,
      entityStatuses
    } = this.state;

    let entitiesToUpdate;
    //  entityStatus format is array [ <GUID>, <ENTITY_UPDATE_STATUS.SUCCESS> ]
    const statusEntries = Object.entries(entityStatuses);
    if (statusEntries.length) {
      entitiesToUpdate = statusEntries
        .filter(
          ([, entityStatus]) => entityStatus !== ENTITY_UPDATE_STATUS.SUCCESS
        )
        .map(item => item[0]);
    } else {
      entitiesToUpdate = selectedEntityIds;
    }
    const statusObject = { ...entityStatuses };
    entitiesToUpdate.forEach(entityId => {
      if (statusObject[entityId]) {
        statusObject[entityId] = ENTITY_UPDATE_STATUS.ADDING;
      }
    });

    const setEntityStatusFn = async function(entityId, hasErrors = false) {
      const previousStatuses = this.state.entityStatuses;
      this.setState({
        entityStatuses: {
          ...previousStatuses,
          [entityId]: hasErrors
            ? ENTITY_UPDATE_STATUS.ERROR
            : ENTITY_UPDATE_STATUS.SUCCESS
        }
      });
    }.bind(this);
    this.enableSpinner(true);

    this.setState({ entityStatuses: statusObject });

    const tagsToAdd = {};
    tagsToAdd[selectedCurrentTag] = selectedNewTagValue;

    await addTags({
      entitiesToUpdate,
      tagsToAdd,
      setEntityStatusFn,
      maxThreads: 2
    });

    // create a list of entities w/ newly added tags
    const updatedEntityIds = (() => {
      const successGuids = [];
      for (const [guid, status] of Object.entries(this.state.entityStatuses)) {
        if (status === ENTITY_UPDATE_STATUS.SUCCESS) {
          successGuids.push(guid);
        }
      }
      return entitiesToUpdate.filter(update_guid =>
        successGuids.find(guid => update_guid === guid)
      );
    })(); // eof updatedEntities

    if (updatedEntityIds && updatedEntityIds.length === 0) {
      logger.warn(`Bulk edit: WARNING: NO Tags to delete, skipping`);
      return;
    }

    await deleteTagValues({
      updatedEntityIds,
      entityTagsMap,
      tagKey: selectedCurrentTag,
      tagValue: selectedCurrentTagValue,
      newTagValue: selectedNewTagValue,
      setEntityStatusFn,
      maxThreads: 2
    });
    await this.props.reloadTagsFn(selectedEntityIds);
    this.enableSpinner(false);
  };

  changeCurrentTag = (e, value) => this.setState({ selectedCurrentTag: value });
  changeCurrentTagValue = (e, value) =>
    this.setState({ selectedCurrentTagValue: value });

  changeNewTagValue = (e, value) =>
    this.setState({ selectedNewTagValue: value });

  render() {
    const { selectedEntityIds, tagHierarchy, entityTagsMap } = this.props;
    const {
      entityStatuses,
      selectedCurrentTag,
      selectedCurrentTagValue,
      selectedNewTagValue
    } = this.state;
    const tagsOnEntities = Array.from(
      selectedEntityIds.reduce((accumulator, entityGuid) => {
        (entityTagsMap[entityGuid] || []).forEach(tag =>
          accumulator.add(tag.tagKey)
        );
        return accumulator;
      }, new Set())
    ).sort((a, b) => (a.toUpperCase() > b.toUpperCase() ? 1 : -1));
    const currentValuesForTag = selectedCurrentTag
      ? Object.entries(tagHierarchy[selectedCurrentTag] || {})
          .filter(([, entities]) =>
            entities.some(entity => selectedEntityIds.includes(entity.guid))
          )
          .map(([tagKey]) => tagKey)
      : [];
    const tagValueSuggestions = selectedCurrentTag
      ? Object.keys(tagHierarchy[selectedCurrentTag] || {}).reduce(
          (accumulator, tagValue) => (
            (accumulator[tagValue] = tagValue), accumulator // eslint-disable-line no-sequences, prettier/prettier
          ),
          {}
        )
      : {};
    const statusEntries = Object.entries(entityStatuses);
    const loadingEntities = statusEntries
      .filter(([, status]) =>
        [ENTITY_UPDATE_STATUS.ADDING, ENTITY_UPDATE_STATUS.REMOVING].includes(
          status
        )
      )
      .map(([entityId]) => entityId);
    const addSuccessEntities = statusEntries
      .filter(([, status]) => status > ENTITY_UPDATE_STATUS.ADD_ERROR)
      .map(([entityId]) => entityId);
    const deleteSuccessEntities = statusEntries
      .filter(([, status]) => status === ENTITY_UPDATE_STATUS.SUCCESS)
      .map(([entityId]) => entityId);
    const addErrorEntities = statusEntries
      .filter(([, status]) => status === ENTITY_UPDATE_STATUS.ADD_ERROR)
      .map(([entityId]) => entityId);
    const deleteErrorEntities = statusEntries
      .filter(([, status]) => status === ENTITY_UPDATE_STATUS.REMOVE_ERROR)
      .map(([entityId]) => entityId);
    const allSucceeded =
      deleteSuccessEntities.length === selectedEntityIds.length;

    let resultText = '';
    if (!!addErrorEntities.length || !!deleteErrorEntities.length) {
      resultText = 'Retry';
    } else if (allSucceeded) {
      resultText = 'Tags changed!';
    } else {
      resultText = 'Change value';
    }

    if (this.state.enableSpinner) {
      return <Spinner />;
    }

    return (
      <div className="full-height-modal">
        <div>
          <HeadingText type={HeadingText.TYPE.HEADING_1}>
            Change value
          </HeadingText>
          <div style={{ margin: '8px 8px 8px 0' }}>Select your tag</div>
          <Select
            className="full-width-select"
            value={selectedCurrentTag}
            onChange={this.changeCurrentTag}
          >
            <SelectItem disabled value="">
              Current tag
            </SelectItem>
            {tagsOnEntities.map(tag => {
              return (
                <SelectItem key={`current-tag-select-${tag}`} value={tag}>
                  {tag}
                </SelectItem>
              );
            })}
          </Select>
          <div style={{ margin: '8px 8px 8px 0' }}>Select existing value</div>
          <Select
            className="full-width-select"
            value={selectedCurrentTagValue}
            onChange={this.changeCurrentTagValue}
            disabled={!selectedCurrentTag}
          >
            <SelectItem value="">All values</SelectItem>
            {currentValuesForTag.map(tag => {
              return (
                <SelectItem key={`current-tag-value-select-${tag}`} value={tag}>
                  {tag}
                </SelectItem>
              );
            })}
          </Select>
          <div style={{ margin: '8px 8px 8px 0' }}>Enter a new value</div>
          <div>
            <div className="add-tag-row">
              <Autocomplete
                style={{ width: '100%' }}
                choices={tagValueSuggestions}
                onChange={this.changeNewTagValue}
                placeholder="Replace with"
                value={selectedNewTagValue}
              />
            </div>
          </div>
        </div>
        <div>
          <div>
            {!!addSuccessEntities.length && (
              <div>
                Add replacement value succeeded for {addSuccessEntities.length}{' '}
                entities
              </div>
            )}
            {!!deleteSuccessEntities.length && (
              <div>
                Remove old value succeeded for {deleteSuccessEntities.length}{' '}
                entities
              </div>
            )}
            {!!addErrorEntities.length && (
              <div>
                Add replacement value failed for {addErrorEntities.length}{' '}
                entities
              </div>
            )}
            {!!deleteErrorEntities.length && (
              <div>
                Remove old value failed for {deleteErrorEntities.length}{' '}
                entities
              </div>
            )}
          </div>
          <div className="button-section">
            <Button
              type={Button.TYPE.PRIMARY}
              onClick={this.applyChangeValueToEntities}
              loading={!!loadingEntities.length}
              disabled={
                !selectedCurrentTag ||
                !selectedNewTagValue ||
                !!loadingEntities.length ||
                allSucceeded
              }
            >
              {resultText}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
