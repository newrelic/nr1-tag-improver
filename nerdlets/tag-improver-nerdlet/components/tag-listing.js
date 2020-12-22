import React from 'react';
import PropTypes from 'prop-types';

import bang from './exclamation.svg';
import check from './green-checkmark.svg';

const TagListing = ({ type, tags, showAllTags }) => {
  const passes = [];
  const fails = [];

  tags.forEach(tag => {
    const hasValue = tag.tagValues && tag.tagValues.find(v => v !== '---');
    if (hasValue) {
      tag.status = 'high__band';
      passes.push(tag);
    }
    if (type === 'mandatory' && !hasValue) {
      tag.status = 'low__band';
      fails.push(tag);
    }
    if (type === 'optional' && !hasValue) {
      tag.status = 'mid__band';
      fails.push(tag);
    }
  });

  const renderTags = typedTags => {
    const getTagStatusIcon = tag => {
      if (tag.status === 'high__band')
        // return '✓'
        return <img src={check} />;
      else return <img src={bang} />;
    };

    return (
      <>
        {typedTags.map((tag, idx) => {
          return (
            <React.Fragment key={idx}>
              <div className={`tags__tag ${tag.status}`}>
                {/* <label className="tags__tag__status">{`${tag.status === 'high__band'
                ? '✓'
                : tag.status === 'mid__band'
                  ? '⚠️'
                  : 'X'
              }`}</label> */}

                {getTagStatusIcon(tag)}
                {/* <img src={bang}/> */}
                <label>{`${tag.tagKey}: ${tag.tagValues}`}</label>
              </div>
            </React.Fragment>
          );
        })}
      </>
    );
  };

  return (
    <div>
      {/* <label className="tags__title">{type}</label> */}
      <div className="tags__list">
        {renderTags(fails)}
        {showAllTags ? renderTags(passes) : ''}
      </div>
    </div>
  );
};

TagListing.propTypes = {
  type: PropTypes.string.isRequired,
  tags: PropTypes.array.isRequired,
  showAllTags: PropTypes.bool.isRequired
};

export default TagListing;
