[![New Relic One Catalog Project header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/New_Relic_One_Catalog_Project.png)](https://opensource.newrelic.com/oss-category/#new-relic-one-catalog-project)

# Tag Improver
![CI](https://github.com/newrelic/nr1-tag-improver/workflows/CI/badge.svg) ![GitHub release (latest SemVer including pre-releases)](https://img.shields.io/github/v/release/newrelic/nr1-tag-improver?include_prereleases&sort=semver) [![Snyk](https://snyk.io/test/github/newrelic/nr1-tag-improver/badge.svg)](https://snyk.io/test/github/newrelic/nr1-tag-improver)

## About this Nerdpack

Tag Improver is here to help you get maximum value from New Relic One by simplifying the process of creating and managing a good tagging strategy.

Define the important entity tags for your environment, report on coverage, and view overall tag usage across everything you own.

## What can Tag Improver do for you

### Report on the coverage of key tags across your portfolio based on an editable tag schema

Tag Improver introduces the concept of “tag policies” which define a set of tags and their enforcement level within an account. Users can specify whether a tag is Required or Optional. Only tags that are identified as Required will be considered when assessing tag policy compliance. As a convenience, we provide you with a default tag policy on deployment of Tag Improver that you may edit to better fit and drive your organization’s tagging strategy.

![View tag policy report](screenshots/tag-policy.png)

### Explore the full set of tag key:values in use across your account

In the Tag Analyzer tab, users can view and analyze all of the tags currently in use for a given entity type in their selected account(s), including those defined in the tag policy but not currently defined for any entities. Tag Analyzer displays all tags in use across the entities of a specific entity type, not just those defined in the tag policy, providing a consolidated and complete view.

With the v1.1 release, users can now seamlessly move from identifying a cohort of entities with a particular value for a tag (or no value at all if undefined) in the Tag Analyzer tab and then operate on those entities in the Entities tab. This new and convenient workflow makes closing coverage gaps and enforcing an organization’s tag policy easy. Some of the other benefits & improvements include:

- Identifying high-cardinality tags and inspecting for duplicate or redundant values
- Identifying and managing duplicate or redundant tag keys (ex. “Environment” vs. “environment”)
- Identifying non-policy tags with high coverage to incorporate into the tag policy

![Explore all tags used across your accounts](screenshots/tag-analysis.png)

### Report the tags in use (and missing) from each entity, and manually manage tags in bulk

In the Policy tab, you can define a policy for tag governance across your account. In the Tag Analyzer tab, you can view adherence to that coverage and values in use. In the Entities tab, it all comes together. As the name indicates, the Entities tab provides an entity-centric view of tags and tag policy coverage, along with the ability to add, modify, or remove tags or values on those entities.

![See entity tag status](screenshots/entity-tagging.png)

## Customizing the Tag Policy

Users can edit the tagging policy in the New Relic UI, either globally for all users, or just for your user (private policy). To customize the default policy in either case, follow these instructions before deploying the app to your account(s).

The Policy report is driven by a policy schema defined in [tag-schema.js](./nerdlets/tag-improver-nerdlet/tag-schema.js)

First, define the set of required and optional tags for your environment.
Edit [tag-schema.js](./nerdlets/tag-improver-nerdlet/tag-schema.js) to reflect your policy.

Each object in the schema JSON should have:

* `key` - the actual tag key as applied to entities in New Relic
* `enforcement` - the schema enforcement level from `TAG_SCHEMA_ENFORCEMENT` (controls presentation on Overview tab)
* `label` - human-readable name of the tag, generally the same or a more verbose version of `key`
* `purpose` - optional, more detailed description of usage or provenance for the tag value

When done, follow the instructions above under **Enabling this App** to deploy your changes to your account.

## Caveats

As with anything, a few caveats:

Tag Improver currently does not recognize the mutability of tags. Attempts to add or edit an immutable tag will result in creating a new tag key but scoped to the user. A future release of Tag Improver is planned to address and remedy this behavior.
A manual refresh Tag Improver may be needed to reflect some changes implemented (bulk edit actions)
Tag Improver, like many Nerdpacks, employs Nerdstore for storage needs; at this time, tag policies are user-scoped. This limitation will be addressed in a future release of Tag Improver or other tag management functionality in NR1.

## What do you need to make this work?

Access to New Relic One and a Full Stack Observability subscription.

Editing tags requires a Full Platform User-level account.

## Enabling this App

This App is available via the New Relic Catalog. 

To enable it in your account: 
1. go to `Add Data > Apps and Visualzations` and search for "Tag Improver"
2. Click the `Tag Improver` card, and then click the `Add this App` button to add it to your account(s)
3. Click `Open App` to launch the app (note: on the first time accessing the app, you may be prompted to enable it)

Once you have added your accounts, you can also open the app by:
1. Open the `Apps` left-hand navigation menu item (you may need to click on the `Add More` ellipsis if it doesn't show up by default)
2. In the `Your Apps` section, locate and click on the `Tag Improver` card to open the app 

#### Manual Deployment
If you need to customize the app, fork the codebase and follow the instructions on how to [Customize a Nerdpack](https://developer.newrelic.com/build-apps/customize-nerdpack). If you have a change you feel everyone can benefit from, please submit a PR!

## Support

<a href="https://github.com/newrelic?q=nrlabs-viz&amp;type=all&amp;language=&amp;sort="><img src="https://user-images.githubusercontent.com/1786630/214122263-7a5795f6-f4e3-4aa0-b3f5-2f27aff16098.png" height=50 /></a>

This project is actively maintained by the New Relic Labs team. Connect with us directly by [creating issues](../../issues) or [asking questions in the discussions section](../../discussions) of this repo.

We also encourage you to bring your experiences and questions to the [Explorers Hub](https://discuss.newrelic.com) where our community members collaborate on solutions and new ideas.

New Relic has open-sourced this project, which is provided AS-IS WITHOUT WARRANTY OR DEDICATED SUPPORT.

## Security

As noted in our [security policy](https://github.com/newrelic/nr1-tag-improver/security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

## Contributing

Contributions are encouraged! If you submit an enhancement request, we'll invite you to contribute the change yourself. Please review our [Contributors Guide](CONTRIBUTING.md).

Keep in mind that when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. If you'd like to execute our corporate CLA, or if you have any questions, please drop us an email at opensource+nr1-tag-imporover@newrelic.com.

## Open source license

This project is distributed under the [Apache 2 license](LICENSE).
