# History of this branch

This branch consolidates existing work to make the current application easier
to review. It was prepared on 26 October 2026. The original history remains
preserved on `main` in the source repository.

The first commit imports a working application and its existing tests. The next
five commits preserve real subsequent changes in their original order. They are
not a reconstruction of a product-first implementation from an empty scaffold.
Commit objects were created during consolidation, without backdating them.

## Source and mapping

- Source snapshot: `22499b7b08b401bd43b90b17b8fcc2ccd230d17b`.
- Imported baseline: `c01c0f2748cd26f0ed8e1656a8135e3009071f21`.

- `c01c0f2748cd26f0ed8e1656a8135e3009071f21` → `ab531ee07574e62d34cbdc3f568febaa7bec08db`: chore: import existing Strata ETF worksheet demo.
- `31aa10b694fe7e651406d85a7642b37ee58da7ef` → `e5c341e5732b97e3e2d49e7e015ad82d29ad4020`: feat: declare native worksheet model relationships.
- `8f74b0b8194027d34e27488d1dec9f8441d5a3e9` → `98b94de8c3ff4b76f0438ac2f47e6a84d4210168`: refactor: create acceptance events through native relationship.
- `e65e962f30af32e32b4b44cd8b725257d141bcd7` → `fa866e659f0248810bb219091806b3a58ecc15d4`: refactor: harden explicit SQL and use native fixture schema.
- `e3b530fa67cd90be416d72537613b98f863dce3a` → `d48cf28d6814f462e773df2acdbf60fb95ccd416`: fix: typecheck test sources and isolate framework repro.
- `22499b7b08b401bd43b90b17b8fcc2ccd230d17b` → `2f9de0c4e2e9e9f99454e272468f055e6cff6e0b`: feat: improve mobile offer and add reproducible local tests.

## Verification and evidence

Each imported or replayed application tree was checked against its source tree.
The final application content matches the source snapshot exactly. This file is
the only additional tracked file in the final branch.

This history-only consolidation did not rerun application tests and does not
establish when tests were first written. Historical test and deployment reports
retain their original scope; they are not new results from this operation.

Original conversation exports, edited excerpts and newly drafted example
conversations are different kinds of material. An edited or example conversation
must not be presented as an authentic unmodified development export.

Publication and deployment are separate from preparing this local branch.
