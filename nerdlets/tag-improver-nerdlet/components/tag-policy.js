import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Select,
  SelectItem,
  Spinner,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell,
  TextField,
  Tooltip,
  UserStorageMutation
} from 'nr1';
import { TAG_SCHEMA_ENFORCEMENT, ENFORCEMENT_PRIORITY } from '../tag-schema';
import Autocomplete from './autocomplete';

const coverageTooltipText = `For required tags, less than 50 percent coverage changes the state to red, between 50 to 80 percent changes the state to yellow, and over 80 percent changes the state to green.`;

const COLOR_BREAKS = {
  required: [
    [80, '#90ff90'],
    [50, 'yellow'],
    [0, '#ff9090']
  ],
  default: [[0, '#f0f0f0']]
};

const SCHEMA_ENFORCEMENT_LABELS = {
  [TAG_SCHEMA_ENFORCEMENT.required]: 'Required',
  [TAG_SCHEMA_ENFORCEMENT.optional]: 'Optional'
};

export default class TaggingPolicy extends React.Component {
  static propTypes = {
    updatePolicy: PropTypes.func,
    tagHierarchy: PropTypes.object,
    schema: PropTypes.array,
    entityCount: PropTypes.number
  };

  constructor(props) {
    super(props);
    this.state = {
      workingSchema: null,
      isEditMode: false,
      savingPolicy: false,
      policySaveErrored: false,
      tableSorting: {
        enforcement: 'ascending',
        key: 'ascending'
      }
    };
  }

  applyEdits = () => {
    const { updatePolicy } = this.props;
    const { workingSchema: policy } = this.state;
    this.setState({ savingPolicy: true });
    UserStorageMutation.mutate({
      actionType: UserStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
      collection: 'nr1-tag-improver',
      documentId: 'tagging-policy',
      document: { policy: policy }
    })
      .then(() => {
        this.setState(
          {
            isEditMode: false,
            workingSchema: null,
            savingPolicy: false,
            policySaveErrored: false
          },
          () => updatePolicy(policy)
        );
      })
      .catch(() => {
        this.setState({ savingPolicy: false, policySaveErrored: true });
      });
  };

  startEditing = () => {
    const { schema } = this.props;
    const workingSchema = schema.map(schemaRule => ({ ...schemaRule }));
    this.setState({ isEditMode: true, workingSchema });
  };

  cancelEditing = () => {
    this.setState({ isEditMode: false, workingSchema: null });
  };

  onChangeKey = index => (e, value) => {
    const { workingSchema } = this.state;
    const itemAtIndex = workingSchema[index];
    const newItem = { ...itemAtIndex, key: value };
    this.setState({
      workingSchema: [
        ...workingSchema.slice(0, index),
        newItem,
        ...workingSchema.slice(index + 1, workingSchema.length)
      ]
    });
  };

  onChangeLabel = index => e => {
    const { workingSchema } = this.state;
    const itemAtIndex = workingSchema[index];
    const newItem = { ...itemAtIndex, label: e.currentTarget.value };
    this.setState({
      workingSchema: [
        ...workingSchema.slice(0, index),
        newItem,
        ...workingSchema.slice(index + 1, workingSchema.length)
      ]
    });
  };

  onChangeEnforcement = index => (_, value) => {
    const { workingSchema } = this.state;
    const itemAtIndex = workingSchema[index];
    const newItem = { ...itemAtIndex, enforcement: value };
    this.setState({
      workingSchema: [
        ...workingSchema.slice(0, index),
        newItem,
        ...workingSchema.slice(index + 1, workingSchema.length)
      ]
    });
  };

  onChangePurpose = index => e => {
    const { workingSchema } = this.state;
    const itemAtIndex = workingSchema[index];
    const newItem = { ...itemAtIndex, purpose: e.currentTarget.value };
    this.setState({
      workingSchema: [
        ...workingSchema.slice(0, index),
        newItem,
        ...workingSchema.slice(index + 1, workingSchema.length)
      ]
    });
  };

  addPolicyRow = () => {
    const { workingSchema } = this.state;
    this.setState({
      workingSchema: [
        ...workingSchema,
        {
          key: '',
          label: '',
          enforcement: TAG_SCHEMA_ENFORCEMENT.optional,
          purpose: ''
        }
      ]
    });
  };

  removePolicyRow = index => () => {
    const { workingSchema } = this.state;
    this.setState({
      workingSchema: [
        ...workingSchema.slice(0, index),
        ...workingSchema.slice(index + 1, workingSchema.length)
      ]
    });
  };

  onClickTableHeaderCell = key => (event, sortingData) => {
    const previousSorting = this.state.tableSorting;
    this.setState({
      tableSorting: {
        ...previousSorting,
        [key]: sortingData.nextSortingType
      }
    });
  };

  render() {
    const { schema, tagHierarchy, entityCount } = this.props;
    const {
      workingSchema,
      isEditMode,
      policySaveErrored,
      savingPolicy,
      tableSorting
    } = this.state;
    /*
    {
        label: 'Owning team',
        key: 'Team',
        purpose: '',
        enforcement: TAG_SCHEMA_ENFORCEMENT.required,
        allowedValues: [],
    },
    */

    if (!schema) {
      return <Spinner />;
    }
    let availableTagsDictionary = {};
    if (isEditMode) {
      const currentTagList = workingSchema
        ? workingSchema.map(schemaRule => schemaRule.key)
        : [];
      const existingTags = Object.keys(tagHierarchy);
      const availableTagsList = existingTags
        .filter(tag => !currentTagList.includes(tag))
        .sort((a, b) => (a.toUpperCase() > b.toUpperCase() ? 1 : -1));
      availableTagsDictionary = availableTagsList.reduce(
        (accumulator, tag) => ((accumulator[tag] = tag), accumulator), // eslint-disable-line no-sequences
        {}
      );
    }

    const coverageAndCountsPerTag = (isEditMode
      ? workingSchema
      : schema
    ).reduce((accumulator, rule) => {
      let count = 0;
      let coverage = 0;
      const tagHistogram = tagHierarchy[rule.key];
      if (tagHistogram) {
        count = Object.keys(tagHistogram).reduce((acc, v) => {
          tagHistogram[v].map(e => acc.add(e.guid));
          return acc;
        }, new Set()).size;
        coverage = Math.floor((count * 100) / entityCount);
      }

      const colorMap = COLOR_BREAKS[rule.enforcement] || COLOR_BREAKS.default;
      const cellColor = (colorMap.find(r => coverage >= r[0]) ||
        COLOR_BREAKS.default[0])[1];

      accumulator[rule.key] = {
        cellColor,
        coverage,
        count
      };
      return accumulator;
    }, {});
    const disableSaving =
      savingPolicy ||
      (isEditMode &&
        workingSchema &&
        workingSchema.some(schemaRule => !schemaRule.key));
    return (
      <div>
        <div>
          <div
            className="button-section"
            style={{ padding: 8, paddingRight: 16 }}
          >
            {isEditMode ? (
              <>
                {policySaveErrored && (
                  <div style={{ marginRight: 8 }}>
                    Error occurred saving policy.
                  </div>
                )}
                <Button onClick={this.cancelEditing}>Cancel</Button>
                <Button
                  loading={savingPolicy}
                  disabled={disableSaving}
                  onClick={this.applyEdits}
                >
                  Apply Edits
                </Button>
              </>
            ) : (
              <Button onClick={this.startEditing}>Edit Policy</Button>
            )}
          </div>
        </div>
        <Table items={isEditMode ? workingSchema : schema}>
          <TableHeader>
            <TableHeaderCell
              width="200px"
              sortable={!isEditMode}
              sortingOrder={4}
              value={({ item }) => item.label}
              onClick={this.onClickTableHeaderCell('label')}
              sortingType={
                isEditMode
                  ? TableHeaderCell.SORTING_TYPE.NONE
                  : tableSorting.label
              }
            >
              Name
            </TableHeaderCell>
            <TableHeaderCell
              width="150px"
              sortable={!isEditMode}
              sortingOrder={3}
              value={({ item }) => item.key}
              onClick={this.onClickTableHeaderCell('key')}
              sortingType={
                isEditMode
                  ? TableHeaderCell.SORTING_TYPE.NONE
                  : tableSorting.key
              }
            >
              Tag key
            </TableHeaderCell>
            <TableHeaderCell
              width="200px"
              sortable={!isEditMode}
              sortingOrder={0}
              value={({ item }) => ENFORCEMENT_PRIORITY[item.enforcement]}
              onClick={this.onClickTableHeaderCell('enforcement')}
              sortingType={
                isEditMode
                  ? TableHeaderCell.SORTING_TYPE.NONE
                  : tableSorting.enforcement
              }
            >
              Enforcement level
            </TableHeaderCell>
            <TableHeaderCell
              width="100px"
              sortable={!isEditMode}
              sortingOrder={1}
              value={({ item }) =>
                (coverageAndCountsPerTag[item.key] || {}).coverage || 0
              }
              onClick={this.onClickTableHeaderCell('coverage')}
              sortingType={
                isEditMode
                  ? TableHeaderCell.SORTING_TYPE.NONE
                  : tableSorting.coverage
              }
            >
              <Tooltip
                text={coverageTooltipText}
                placementType={Tooltip.PLACEMENT_TYPE.BOTTOM}
              >
                Coverage
              </Tooltip>
            </TableHeaderCell>
            <TableHeaderCell
              width="100px"
              sortable={!isEditMode}
              sortingOrder={2}
              value={({ item }) =>
                (coverageAndCountsPerTag[item.key] || {}).count || 0
              }
              onClick={this.onClickTableHeaderCell('count')}
              sortingType={
                isEditMode
                  ? TableHeaderCell.SORTING_TYPE.NONE
                  : tableSorting.count
              }
            >
              Entity count
            </TableHeaderCell>
            <TableHeaderCell
              sortable={!isEditMode}
              sortingOrder={5}
              value={({ item }) => item.purpose}
              onClick={this.onClickTableHeaderCell('purpose')}
              sortingType={
                isEditMode
                  ? TableHeaderCell.SORTING_TYPE.NONE
                  : tableSorting.purpose
              }
            >
              Purpose
            </TableHeaderCell>
            <TableHeaderCell width="50px" />
          </TableHeader>

          {({ item, index }) => (
            <TableRow>
              <TableRowCell>
                {isEditMode ? (
                  <TextField
                    onChange={this.onChangeLabel(index)}
                    value={item.label}
                  />
                ) : (
                  item.label
                )}
              </TableRowCell>
              <TableRowCell>
                {isEditMode ? (
                  <Autocomplete
                    value={item.key}
                    choices={availableTagsDictionary}
                    placeholder="Tag"
                    onChange={this.onChangeKey(index)}
                  />
                ) : (
                  item.key
                )}
              </TableRowCell>
              <TableRowCell>
                {isEditMode ? (
                  <Select
                    value={item.enforcement}
                    onChange={this.onChangeEnforcement(index)}
                  >
                    <SelectItem value="">Enforcement Level</SelectItem>
                    {Object.entries(SCHEMA_ENFORCEMENT_LABELS).map(
                      ([enforcementLevel, label]) => (
                        <SelectItem
                          key={`enforcement-choice-${enforcementLevel}`}
                          value={enforcementLevel}
                        >
                          {label}
                        </SelectItem>
                      )
                    )}
                  </Select>
                ) : (
                  item.enforcement
                )}
              </TableRowCell>
              <TableRowCell
                alignmentType={TableRowCell.ALIGNMENT_TYPE.RIGHT}
                style={{
                  fontFamily: 'Menlo-Regular, monospace',
                  backgroundColor: (coverageAndCountsPerTag[item.key] || {})
                    .cellColor
                }}
              >
                {(coverageAndCountsPerTag[item.key] || {}).coverage || 0}%
              </TableRowCell>
              <TableRowCell
                style={{
                  fontFamily: 'Menlo-Regular, monospace'
                }}
                alignmentType={TableRowCell.ALIGNMENT_TYPE.RIGHT}
              >
                {(
                  (coverageAndCountsPerTag[item.key] || {}).count || 0
                ).toLocaleString()}
              </TableRowCell>
              <TableRowCell>
                {isEditMode ? (
                  <TextField
                    style={{ width: '100%' }}
                    onChange={this.onChangePurpose(index)}
                    value={item.purpose}
                  />
                ) : (
                  item.purpose
                )}
              </TableRowCell>
              <TableRowCell>
                {isEditMode ? (
                  <Button
                    sizeType={Button.SIZE_TYPE.SMALL}
                    type={Button.TYPE.PLAIN}
                    onClick={this.removePolicyRow(index)}
                    iconType={Button.ICON_TYPE.INTERFACE__OPERATIONS__TRASH}
                  />
                ) : (
                  ''
                )}
              </TableRowCell>
            </TableRow>
          )}
        </Table>
        {isEditMode && (
          <div>
            <Button
              iconType={Button.ICON_TYPE.INTERFACE__SIGN__PLUS}
              type={Button.TYPE.PLAIN}
              onClick={this.addPolicyRow}
            >
              Add row
            </Button>
          </div>
        )}
      </div>
    );
  }
}
