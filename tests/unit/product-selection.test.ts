import { expect, it } from "vitest";
import { selectShowcaseProducts } from "@/lib/cms/product-selection";

const products = [{ slug: "banana-one", is_featured: true }, { slug: "banana-two", is_featured: true }, { slug: "new-product", is_featured: false }];
it("automatically includes new published products when none are hand-picked", () => {
  expect(selectShowcaseProducts(products, { product_slugs: [] })).toHaveLength(3);
});
it("respects explicit owner selections and filters deleted or unpublished records", () => {
  expect(selectShowcaseProducts(products, { product_slugs: ["banana-two", "not-published", "banana-two"] })).toEqual([products[1]]);
});
it("supports all, featured, selected and maximum display controls", () => {
  expect(selectShowcaseProducts(products, { product_slugs: ["banana-one"], product_selection: "all", max_products: 2 })).toEqual(products.slice(0, 2));
  expect(selectShowcaseProducts(products, { product_slugs: [], product_selection: "featured" })).toHaveLength(2);
  expect(selectShowcaseProducts(products, { product_slugs: [], product_selection: "selected" })).toEqual([]);
});
