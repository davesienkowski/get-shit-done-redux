---
type: Fixed
pr: 43
---

**Object-valued capability gate `equals` is now compared key-order-insensitively.** `artifact-frontmatter-equals` compared object/array `equals` and `actual` values with key-order-sensitive `JSON.stringify`, so a gate declaring `equals: {a: 1, b: 2}` spuriously **blocked** an artifact whose frontmatter mapping was the deep-equal `{b: 2, a: 1}` — a valid workflow failed a gate it genuinely satisfied. The object/array branch now serializes through a recursive key-sorted stable serializer, so two deep-equal mappings that differ only in key order match; the scalar `String()` coercion path is unchanged and array element order stays significant. (#42)
