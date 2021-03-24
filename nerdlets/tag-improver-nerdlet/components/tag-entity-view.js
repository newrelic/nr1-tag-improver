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
  Radio,
  RadioGroup,
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

export default class TagEntityView extends React.Component {
  static propTypes = {
    tagHierarchy: PropTypes.object,
    entityTagsMap: PropTypes.object,
    getTagKeys: PropTypes.array,
    reloadTagsFn: PropTypes.func,
    selectedTagKey: PropTypes.string,
    selectedTagValue: PropTypes.string
  };

  state = {
    firstTagKey: this.props.selectedTagKey || 'account',
    table_column_1: TableHeaderCell.SORTING_TYPE.ASCENDING,
    selectedEntities: {},
    selectedEntityIds: [],
    showAllTags: true,
    entityDisplayOption: '1' // only show entities with tag value present
  };

  componentDidMount() {
    // setTimeout(() => { /* do nothing */ console.log("waiting for 800 ms"); }, 800);
    const urlState = this.context || {};
    this.setState({
      firstTagKey:
        this.props.selectedTagKey ||
        urlState.entityViewFirstTagKey ||
        'account',
      entityDisplayOption:
        this.props.selectedTagValue === '<not present>' ? '2' : '1',
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
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        firstTagKey:
          this.props.selectedTagKey ||
          this.context.entityViewFirstTagKey ||
          'account',
        entityDisplayOption:
          this.props.selectedTagValue === '<not present>' ? '2' : '1',
        selectedEntities: {},
        selectedEntityIds: []
      });
    }
  }

  static contextType = NerdletStateContext;
  flushSelectedEntitiesTimeout = null;

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
    this.setState({ firstTagKey });
    nerdlet.setUrlState({ entityViewFirstTagKey: firstTagKey });
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
    const { firstTagKey, entityDisplayOption } = this.state;

    let newTagHierarchy = {};
    if (
      entityDisplayOption === '1' &&
      selectedTagKey &&
      selectedTagValue &&
      selectedTagValue !== '<not present>'
    ) {
      newTagHierarchy[selectedTagKey] = {};
      newTagHierarchy[selectedTagKey][selectedTagValue] =
        tagHierarchy[selectedTagKey][selectedTagValue];
    } else {
      newTagHierarchy = tagHierarchy;
    }
    const entities = {};
    for (const tagData of Object.values(newTagHierarchy)) {
      for (const entityList of Object.values(tagData)) {
        for (const entity of entityList) {
          if (!entities[entity.guid]) {
            const activeTagValue =
              selectedTagKey &&
              selectedTagValue &&
              entityDisplayOption === '1' &&
              selectedTagValue !== '<not present>'
                ? selectedTagValue
                : this.findTagValue(entity, firstTagKey);

            const tagHasValue = entityTagsMap[entity.guid].find(
              tag => tag.tagKey === firstTagKey
            );
            // const tagHasValue = entity.tags.find(tag => tag.tagKey === firstTagKey);

            if (
              (entityDisplayOption === '1' && !tagHasValue) ||
              (entityDisplayOption === '2' && tagHasValue)
            ) {
              continue;
            } else {
              // if (selectAllEntities && selectedTagKey && selectedTagValue) {
              //   this.onSelectEntity(
              //     { target: { checked: true } },
              //     { item: { entityGuid: entity.guid } }
              //   );
              // }
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

  onRadioChange = (event, value) => {
    // value: 1 = show entities with tag value present
    //        2 = show entities with tag value not present
    //        3 = show entities with or without tag value present
    this.setState({
      entityDisplayOption: value
    });
  };

  render() {
    const { updateFirstTagKey, setSortingColumn } = this;
    const {
      firstTagKey,
      selectedEntities,
      selectedEntityIds,
      showAllTags,
      entityDisplayOption
    } = this.state;
    const {
      tagHierarchy,
      entityTagsMap,
      reloadTagsFn,
      selectedTagKey,
      selectedTagValue
    } = this.props;
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

    return (
      <Grid className="primary-grid">
        <GridItem
          className="primary-content-container entity-view-header-bar"
          columnSpan={12}
        >
          <div>
            <div>
              Show values for this tag in the table:
              <Dropdown
                title={firstTagKey}
                items={tagKeys}
                disabled={selectedTagKey && selectedTagValue}
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
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            <div style={{ margin: '10px' }}>
              <RadioGroup
                onChange={this.onRadioChange}
                value={entityDisplayOption || '1'}
              >
                <Radio label="Tag value present" value="1" />
                <Radio label="Tag value not present" value="2" />
                <Radio label="Both" value="3" />
              </RadioGroup>
            </div>
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
                {showAllTags ? '' : 'Undefined'} Mandatory Tags
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
