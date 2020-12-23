import React from 'react';
import PropTypes from 'prop-types';

import { Dropdown, DropdownItem, Grid, GridItem, HeadingText } from 'nr1';

import TagTable from './tag-table';
import TagValueTable from './tag-value-table';

export default class TagCoverageView extends React.Component {
  static propTypes = {
    entityCount: PropTypes.number,
    tagHierarchy: PropTypes.object,
    height: PropTypes.number
  };

  state = {
    currentTagGroup: 'account' // NOTE: this will always be present
  };

  updateCurrentTagGroup = currentTagGroup => {
    this.setState({ currentTagGroup });
  };

  getTagTableData = () => {
    const { entityCount, tagHierarchy } = this.props;

    return Object.keys(tagHierarchy).map(k => {
      const count = Object.keys(tagHierarchy[k]).reduce(
        (acc, v) => acc + tagHierarchy[k][v].length,
        0
      );
      const coverage = Math.floor((count * 100) / entityCount);
      return {
        tagKey: k,
        cardinality: Object.keys(tagHierarchy[k]).length,
        entityCount: count,
        entityPercent: coverage
      };
    });
  };

  getValueTableData = () => {
    const { tagHierarchy } = this.props;
    const { currentTagGroup } = this.state;
    if (!tagHierarchy[currentTagGroup]) return [];

    return Object.keys(tagHierarchy[currentTagGroup]).map(v => {
      return {
        tagValue: v,
        entityCount: tagHierarchy[currentTagGroup][v].length
      };
    });
  };

  render() {
    const { getTagTableData, getValueTableData, updateCurrentTagGroup } = this;
    const { tagHierarchy } = this.props;
    const { currentTagGroup } = this.state;
    const currentTagGroupIsPopulated =
      tagHierarchy[currentTagGroup] &&
      Object.keys(tagHierarchy[currentTagGroup]).length > 0;

    return (
      <div
        className="split"
        style={{ height: (this.props.height || 1200) - 120 }}
      >
        <Grid className="primary-grid" style={{ alignContent: 'start' }}>
          <GridItem className="primary-content-container" columnSpan={7}>
            <HeadingText type={HeadingText.TYPE.HEADING_4}>
              Tags in use
            </HeadingText>
          </GridItem>
          <GridItem className="primary-content-container" columnSpan={1}>
            <></>
          </GridItem>
          <GridItem className="primary-content-container" columnSpan={4}>
            <HeadingText type={HeadingText.TYPE.HEADING_4}>
              Tag
              <Dropdown
                title={currentTagGroup}
                items={Object.keys(tagHierarchy)}
                style={{
                  display: 'inline-block',
                  margin: '0 .5em',
                  verticalAlign: 'middle'
                }}
              >
                {({ item, index }) => (
                  <DropdownItem
                    key={`d-${index}`}
                    onClick={() => updateCurrentTagGroup(item)}
                  >
                    {item}
                  </DropdownItem>
                )}
              </Dropdown>
              breakdown
            </HeadingText>
          </GridItem>

          <GridItem className="primary-content-container" columnSpan={12}>
            <hr />
          </GridItem>

          <GridItem className="primary-content-container" columnSpan={7}>
            <div className="left">
              <TagTable
                getTableData={() => getTagTableData()}
                selectTag={tagKey => updateCurrentTagGroup(tagKey)}
              />
            </div>
          </GridItem>
          <GridItem className="primary-content-container" columnSpan={1}>
            <></>
          </GridItem>
          <GridItem className="primary-content-container" columnSpan={4}>
            {currentTagGroupIsPopulated ? (
              <div className="right">
                <TagValueTable getTableData={() => getValueTableData()} />
              </div>
            ) : (
              <></>
            )}
          </GridItem>
        </Grid>
      </div>
    );
  }
}
