import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Checkbox,
  Dropdown,
  DropdownSection,
  DropdownItem,
  Grid,
  GridItem,
  Link,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell,
  navigation,
  NerdletStateContext,
  nerdlet
} from 'nr1';

import ModalButton from './modal-button';
import TagBulkAdd from './tag-bulk-add';
import TagBulkRename from './tag-bulk-rename';
import TagBulkEdit from './tag-bulk-edit';
import TagBulkDelete from './tag-bulk-delete';
import TagListing from './tag-listing';

import { COMPLIANCEBANDS } from '../tag-schema';

const DISPLAY_OPTION = {
  SPECIFIC_TAG_VALUE: '1',
  ALL_TAG_VALUES: '2',
  TAG_NOT_DEFINED: '3',
  ALL_ENTITIES: '4'
};

export default class TagEntityView extends React.Component {
  static propTypes = {
    tagHierarchy: PropTypes.object,
    selectedEntityType: PropTypes.object,
    entityCount: PropTypes.number,
    entityTagsMap: PropTypes.object,
    getTagKeys: PropTypes.array,
    reloadTagsFn: PropTypes.func,
    selectedTagKey: PropTypes.string,
    selectedTagValue: PropTypes.string
  };

  state = {
    firstTagKey: this.props.selectedTagKey || 'account',
    selectedEntityType: this.props.selectedEntityType,
    table_column_1: TableHeaderCell.SORTING_TYPE.ASCENDING,
    selectedEntities: {},
    selectedEntityIds: [],
    showAllTags: true,
    dropDownSelectedTagValue: '',
    entityDisplayOption: DISPLAY_OPTION.SPECIFIC_TAG_VALUE // only show entities with tag value present
  };

  static getDerivedStateFromProps(props, state) {
    if (props.selectedEntityType.name !== state.selectedEntityType.name) {
      return {
        selectedEntityType: props.selectedEntityType,
        dropDownSelectedTagValue: ''
      };
    } else {
      return null;
    }
  }

  componentDidMount() {
    const urlState = this.context || {};
    this.setState({
      firstTagKey:
        this.props.selectedTagKey ||
        urlState.entityViewFirstTagKey ||
        'account',
      dropDownSelectedTagValue: this.props.selectedTagValue,
      entityDisplayOption: this.getDisplayOption(this.props.selectedTagValue),
      [`table_column_${urlState.entityViewSortColumn || 1}`]:
        urlState.entityViewSortDirection ||
        TableHeaderCell.SORTING_TYPE.ASCENDING
    });
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.selectedTagKey !== prevProps.selectedTagKey ||
      this.props.selectedTagValue !== prevProps.selectedTagValue
    ) {
      this.setState({
        firstTagKey:
          this.props.selectedTagKey ||
          this.context.entityViewFirstTagKey ||
          'account',
        dropDownSelectedTagValue: this.props.selectedTagValue,
        entityDisplayOption: this.getDisplayOption(this.props.selectedTagValue),
        selectedEntities: {},
        selectedEntityIds: []
      });
    }
  }

  static contextType = NerdletStateContext;
  flushSelectedEntitiesTimeout = null;

  getDisplayOption = tagValue => {
    if (tagValue === '<tag not defined>') return DISPLAY_OPTION.TAG_NOT_DEFINED;
    else if (tagValue) return DISPLAY_OPTION.SPECIFIC_TAG_VALUE;
    else return DISPLAY_OPTION.ALL_TAG_VALUES;
  };

  setSortingColumn = (columnId, event, sortingData) => {
    const updates = [0, 1, 2, 3].reduce((acc, column) => {
      acc[`table_column_${column}`] =
        column === columnId ? sortingData.nextSortingType : undefined;
      if (column === columnId) {
        nerdlet.setUrlState({
          entityViewSortColumn: column,
          entityViewSortDirection: sortingData.nextSortingType
        });
      }
      return acc;
    }, {});
    this.setState(updates);
  };

  updateFirstTagKey = firstTagKey => {
    this.setState({
      firstTagKey,
      dropDownSelectedTagValue: ''
    });
    nerdlet.setUrlState({ entityViewFirstTagKey: firstTagKey });
  };

  updateSelectedTagValue = dropDownSelectedTagValue => {
    let entityDisplayOption = DISPLAY_OPTION.SPECIFIC_TAG_VALUE;
    switch (dropDownSelectedTagValue) {
      case '<any tag value>':
        entityDisplayOption = DISPLAY_OPTION.ALL_TAG_VALUES;
        break;
      case '<tag not defined>':
        entityDisplayOption = DISPLAY_OPTION.TAG_NOT_DEFINED;
        break;
      case '<show all entities>':
        entityDisplayOption = DISPLAY_OPTION.ALL_ENTITIES;
        break;
      default:
        entityDisplayOption = DISPLAY_OPTION.SPECIFIC_TAG_VALUE;
    }

    this.setState({
      dropDownSelectedTagValue,
      entityDisplayOption
    });
  };

  addEntity = (entity, activeTagValue) => {
    return {
      entityName: entity.name,
      entityGuid: entity.guid,
      firstTagValue: activeTagValue,
      complianceScore: entity.complianceScore,
      mandatoryTags: entity.mandatoryTags,
      optionalTags: entity.optionalTags
    };
  };

  getTableData = () => {
    const {
      tagHierarchy,
      entityTagsMap,
      selectedTagKey,
      selectedTagValue
    } = this.props;
    const {
      firstTagKey,
      entityDisplayOption,
      dropDownSelectedTagValue
    } = this.state;

    let newTagHierarchy = {};
    let tagKey = '';
    let tagValue = '';
    if (entityDisplayOption === DISPLAY_OPTION.SPECIFIC_TAG_VALUE) {
      if (
        selectedTagKey &&
        selectedTagValue &&
        selectedTagValue !== '<tag not defined>'
      ) {
        tagKey = selectedTagKey;
        tagValue = selectedTagValue;
      }
      if (dropDownSelectedTagValue) {
        tagKey = firstTagKey;
        tagValue = dropDownSelectedTagValue;
      }
    }

    if (tagKey && tagValue) {
      newTagHierarchy[tagKey] = {};
      newTagHierarchy[tagKey][tagValue] = tagHierarchy[tagKey][tagValue];
    } else {
      newTagHierarchy = tagHierarchy;
    }

    const entities = {};
    for (const tagData of Object.values(newTagHierarchy)) {
      for (const entityList of Object.values(tagData)) {
        for (const entity of entityList) {
          if (!entities[entity.guid]) {
            const activeTagValue =
              tagValue || this.findTagValue(entity, firstTagKey);

            const tagHasValue = entityTagsMap[entity.guid].find(
              tag => tag.tagKey === firstTagKey
            );

            if (
              ((entityDisplayOption === DISPLAY_OPTION.SPECIFIC_TAG_VALUE ||
                entityDisplayOption === DISPLAY_OPTION.ALL_TAG_VALUES) &&
                !tagHasValue) ||
              (entityDisplayOption === DISPLAY_OPTION.TAG_NOT_DEFINED &&
                tagHasValue)
            ) {
              continue;
            } else {
              entities[entity.guid] = this.addEntity(entity, activeTagValue);
            }
          }
        }
      }
    }
    return Object.values(entities);
  };

  findTagValue = (entity, tagKey) => {
    const tag =
      ((entity.tags || []).find(t => t.tagKey === tagKey) || {}).tagValues ||
      [];
    return tag.join(', ');
  };

  getTagValues = () => {
    const { tagHierarchy, entityCount } = this.props;
    const { firstTagKey } = this.state;
    if (!tagHierarchy[firstTagKey]) return [];

    const valueTableData = Object.keys(tagHierarchy[firstTagKey]).map(v => {
      return {
        tagKey: firstTagKey,
        tagValue: v,
        entityCount: tagHierarchy[firstTagKey][v].length
      };
    });
    const valueTableDataEntityCount = valueTableData.reduce((acc, cur) => {
      return acc + cur.entityCount;
    }, 0);
    return [
      {
        tagKey: firstTagKey,
        tagValue: '<any tag value>',
        entityCount: valueTableDataEntityCount
      },
      {
        tagKey: firstTagKey,
        tagValue: '<tag not defined>',
        entityCount: entityCount - valueTableDataEntityCount
      },
      {
        tagKey: firstTagKey,
        tagValue: '<show all entities>',
        entityCount: entityCount
      },
      ...valueTableData
    ];
  };

  onSelectEntity = (evt, { item }) => {
    const { selectedEntities } = this.state;
    selectedEntities[item.entityGuid] = evt.target.checked;
    clearTimeout(this.flushSelectedEntitiesTimeout);
    this.flushSelectedEntitiesTimeout = setTimeout(() => {
      this.setState({
        selectedEntityIds: Object.entries(selectedEntities)
          .filter(([, checked]) => checked)
          .map(([entityId]) => entityId)
      });

      this.flushSelectedEntitiesTimeout = null;
    }, 500);
  };

  onCheckboxChange = event => {
    const showAllTags = event.target.checked;

    this.setState({ showAllTags });
  };

  render() {
    const { updateFirstTagKey, setSortingColumn } = this;
    const {
      firstTagKey,
      selectedEntities,
      selectedEntityIds,
      showAllTags,
      dropDownSelectedTagValue
    } = this.state;
    const { tagHierarchy, entityTagsMap, reloadTagsFn } = this.props;
    const tagKeys = this.props.getTagKeys;
    const entities = this.getTableData();
    const operableEntities = Object.keys(entityTagsMap).filter(entityId =>
      selectedEntityIds.includes(entityId)
    );
    const getBand = score => {
      if (score >= COMPLIANCEBANDS.highBand.lowerLimit) return 'high__band';
      else if (
        COMPLIANCEBANDS.midBand.lowerLimit <= score &&
        score < COMPLIANCEBANDS.midBand.upperLimit
      )
        return 'mid__band';
      else return 'low__band';
    };

    const renderHeaderInfo = () => {
      const { firstTagKey, dropDownSelectedTagValue } = this.state;
      const { selectedEntityType } = this.props;
      let result = `Showing entities for "${selectedEntityType.name}" entity ${selectedEntityType.attribute} `;

      // showing entities with
      const DISPLAY_OPTION = {
        SPECIFIC_TAG_VALUE: '1',
        ALL_TAG_VALUES: '2',
        TAG_NOT_DEFINED: '3',
        ALL_ENTITIES: '4'
      };

      let { entityDisplayOption } = this.state;
      if (
        entityDisplayOption === DISPLAY_OPTION.SPECIFIC_TAG_VALUE &&
        !dropDownSelectedTagValue
      ) {
        entityDisplayOption = DISPLAY_OPTION.ALL_TAG_VALUES;
      }

      switch (entityDisplayOption) {
        case DISPLAY_OPTION.SPECIFIC_TAG_VALUE:
          result += `with tag key: [${firstTagKey}] / tag value: [${dropDownSelectedTagValue}]`;
          break;
        case DISPLAY_OPTION.ALL_TAG_VALUES:
          result += `with tag key: [${firstTagKey}] with any value`;
          break;
        case DISPLAY_OPTION.TAG_NOT_DEFINED:
          result += `with tag key: [${firstTagKey}] not defined`;
          break;
        case DISPLAY_OPTION.ALL_ENTITIES:
          result = `Showing all entities for "${selectedEntityType.name}" entity ${selectedEntityType.attribute}`;
          break;
      }
      return result;
    };

    return (
      <Grid className="primary-grid">
        <GridItem className="primary-content-container" columnSpan={12}>
          <div
            style={{
              display: 'inline-block',
              padding: '10px 0',
              margin: '10x',
              fontSize: '1.5em',
              fontWeight: 'bold',
              backgroundColor: 'DarkSeaGreen'
            }}
          >
            &nbsp;{renderHeaderInfo()}&nbsp;
          </div>
        </GridItem>
        <GridItem
          className="primary-content-container entity-view-header-bar"
          columnSpan={12}
        >
          <div>
            <div>
              Key:Value [
              <Dropdown
                title={firstTagKey}
                items={tagKeys}
                style={{
                  display: 'inline-block',
                  margin: '0 .5em',
                  verticalAlign: 'middle'
                }}
                sectioned
              >
                {({ item: section, index }) => (
                  <DropdownSection
                    key={index}
                    title={section.title}
                    items={section.items}
                  >
                    {({ item, index }) => (
                      <DropdownItem
                        key={`d-${index}`}
                        onClick={() => updateFirstTagKey(item)}
                      >
                        {item}
                      </DropdownItem>
                    )}
                  </DropdownSection>
                )}
              </Dropdown>
              ] : [
              <Dropdown
                title={dropDownSelectedTagValue}
                items={this.getTagValues()}
                style={{
                  display: 'inline-block',
                  margin: '0 .5em',
                  verticalAlign: 'middle'
                }}
              >
                {({ item, index }) => (
                  <DropdownItem
                    key={`v-${index}`}
                    onClick={() => this.updateSelectedTagValue(item.tagValue)}
                  >
                    {item.tagValue}
                  </DropdownItem>
                )}
              </Dropdown>
              ]
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            <div style={{ margin: '35px' }}>
              <Checkbox
                checked={this.state.showAllTags}
                onChange={this.onCheckboxChange}
                label="Show all policy tags"
              />
            </div>
          </div>
          <div className="button-section" style={{ padding: 8 }}>
            <ModalButton
              disabled={!operableEntities.length}
              buttonText="Add tags"
              buttonType={Button.TYPE.PRIMARY}
            >
              <TagBulkAdd
                tagHierarchy={tagHierarchy}
                entities={entities}
                selectedEntityIds={operableEntities}
                reloadTagsFn={reloadTagsFn}
              />
            </ModalButton>
            <ModalButton
              disabled={!operableEntities.length}
              buttonText="Rename tags"
              buttonType={Button.TYPE.PRIMARY}
            >
              <TagBulkRename
                tagHierarchy={tagHierarchy}
                entities={entities}
                selectedEntityIds={operableEntities}
                entityTagsMap={entityTagsMap}
                reloadTagsFn={reloadTagsFn}
              />
            </ModalButton>
            <ModalButton
              disabled={!operableEntities.length}
              buttonText="Change values"
              buttonType={Button.TYPE.PRIMARY}
            >
              <TagBulkEdit
                tagHierarchy={tagHierarchy}
                entities={entities}
                selectedEntityIds={operableEntities}
                entityTagsMap={entityTagsMap}
                reloadTagsFn={reloadTagsFn}
              />
            </ModalButton>
            <ModalButton
              disabled={!operableEntities.length}
              buttonText="Remove tags"
              buttonType={Button.TYPE.PRIMARY}
            >
              <TagBulkDelete
                tagHierarchy={tagHierarchy}
                entities={entities}
                selectedEntityIds={operableEntities}
                entityTagsMap={entityTagsMap}
                reloadTagsFn={reloadTagsFn}
              />
            </ModalButton>
          </div>
        </GridItem>

        <GridItem className="primary-content-container" columnSpan={12}>
          <Table
            items={entities}
            selected={({ item }) => selectedEntities[item.entityGuid]}
            onSelect={this.onSelectEntity}
          >
            <TableHeader>
              <TableHeaderCell
                value={({ item }) => item.entityName}
                width="3fr"
                sortable
                sortingType={this.state.table_column_0}
                sortingOrder={1}
                onClick={(a, b) => setSortingColumn(0, a, b)}
              >
                Entity
              </TableHeaderCell>
              <TableHeaderCell
                value={({ item }) => item.firstTagValue}
                width="3fr"
                sortable
                sortingType={this.state.table_column_1}
                sortingOrder={2}
                onClick={(a, b) => setSortingColumn(1, a, b)}
              >
                {firstTagKey}
              </TableHeaderCell>
              <TableHeaderCell
                value={({ item }) => item.complianceScore}
                width="1fr"
                sortable
                sortingType={this.state.table_column_2}
                sortingOrder={3}
                onClick={(a, b) => setSortingColumn(2, a, b)}
              >
                Score
              </TableHeaderCell>
              <TableHeaderCell width="6fr">
                {showAllTags ? '' : 'Undefined'} Required Tags
              </TableHeaderCell>
              <TableHeaderCell width="7fr">
                {showAllTags ? '' : 'Undefined'} Optional Tags
              </TableHeaderCell>
            </TableHeader>

            {({ item }) => (
              <TableRow>
                <TableRowCell>
                  <Link to={navigation.getOpenEntityLocation(item.entityGuid)}>
                    {item.entityName}
                  </Link>
                </TableRowCell>
                <TableRowCell>{item.firstTagValue}</TableRowCell>
                <TableRowCell
                  width="1"
                  textAlign="center"
                  className={`score ${getBand(item.complianceScore)}`}
                >
                  {`${item.complianceScore.toFixed(2)}%`}
                </TableRowCell>
                <TableRowCell className="tag_nowrap_table_cell">
                  <TagListing
                    type="mandatory"
                    tags={item.mandatoryTags}
                    showAllTags={showAllTags}
                  />
                </TableRowCell>
                <TableRowCell className="tag_nowrap_table_cell">
                  <TagListing
                    type="optional"
                    tags={item.optionalTags}
                    showAllTags={showAllTags}
                  />
                </TableRowCell>
              </TableRow>
            )}
          </Table>
        </GridItem>
      </Grid>
    );
  }
}
