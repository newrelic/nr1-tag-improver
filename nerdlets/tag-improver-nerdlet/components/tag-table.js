import React from 'react';
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell
} from 'nr1';

export default class TagTable extends React.Component {
  state = {
    tag_column_0: TableHeaderCell.SORTING_TYPE.ASCENDING
  };

  setSortingColumn = (columnId, event, sortingData) => {
    const updates = [0, 1, 2, 3].reduce((acc, column) => {
      acc[`tag_column_${column}`] =
        column === columnId ? sortingData.nextSortingType : undefined;
      return acc;
    }, {});
    this.setState(updates);
  };

  render() {
    return (
      <Table items={this.props.getTableData()}>
        <TableHeader>
          <TableHeaderCell
            value={({ item }) => item.tagKey}
            sortable
            sortingType={this.state.tag_column_0}
            sortingOrder={1}
            onClick={this.setSortingColumn.bind(this, 0)}
          >
            Tag name
          </TableHeaderCell>
          <TableHeaderCell
            value={({ item }) => item.cardinality}
            sortable
            sortingType={this.state.tag_column_1}
            sortingOrder={2}
            onClick={this.setSortingColumn.bind(this, 1)}
          >
            Distinct values
          </TableHeaderCell>
          <TableHeaderCell
            value={({ item }) => item.entityCount}
            sortable
            sortingType={this.state.tag_column_2}
            sortingOrder={3}
            onClick={this.setSortingColumn.bind(this, 2)}
          >
            Tagged entities
          </TableHeaderCell>
          <TableHeaderCell
            value={({ item }) => item.entityPercent}
            sortable
            sortingType={this.state.tag_column_3}
            sortingOrder={4}
            onClick={this.setSortingColumn.bind(this, 3)}
          >
            % coverage
          </TableHeaderCell>
        </TableHeader>

        {({ item }) => (
          <TableRow
            onClick={() => {
              this.props.selectTag(item.tagKey);
            }}
          >
            <TableRowCell>{item.tagKey}</TableRowCell>
            <TableRowCell>{item.cardinality}</TableRowCell>
            <TableRowCell>{item.entityCount}</TableRowCell>
            <TableRowCell>{item.entityPercent}</TableRowCell>
          </TableRow>
        )}
      </Table>
    );
  }
}
