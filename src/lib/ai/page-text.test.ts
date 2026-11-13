import { describe, expect, it } from "vitest";
import { MAX_PAGE_IMAGE_CHARS, PAGE_IMAGE_PREFIX, pageImageSchema, parsePageText } from "./page-text";
import { InvalidModelOutputError } from "./proposals";

describe("parsePageText", () => {
  it("returns a valid transcription with the text trimmed", () => {
    expect(parsePageText({ text: "  Unit 3\nFood and drink \n", unreadable: false })).toEqual({
      text: "Unit 3\nFood and drink",
      unreadable: false,
    });
  });

  it("passes unreadable through", () => {
    expect(parsePageText({ text: "Unit 3", unreadable: true })).toEqual({ text: "Unit 3", unreadable: true });
  });

  it("treats an empty or blank text as unreadable", () => {
    expect(parsePageText({ text: "", unreadable: false })).toEqual({ text: "", unreadable: true });
    expect(parsePageText({ text: " \n ", unreadable: false })).toEqual({ text: "", unreadable: true });
  });

  it("throws for wrong types", () => {
    expect(() => parsePageText({ text: 42, unreadable: false })).toThrow(InvalidModelOutputError);
    expect(() => parsePageText({ text: "Unit 3", unreadable: "no" })).toThrow(InvalidModelOutputError);
    expect(() => parsePageText({ text: "Unit 3" })).toThrow(InvalidModelOutputError);
  });

  it("throws for a non-object result", () => {
    expect(() => parsePageText(null)).toThrow(InvalidModelOutputError);
    expect(() => parsePageText("Unit 3")).toThrow(InvalidModelOutputError);
    expect(() => parsePageText([{ text: "Unit 3", unreadable: false }])).toThrow(InvalidModelOutputError);
  });
});

describe("pageImageSchema", () => {
  it("accepts a JPEG data URL", () => {
    const image = `${PAGE_IMAGE_PREFIX}/9j/4AAQ`;
    expect(pageImageSchema.parse({ image })).toEqual({ image });
  });

  it("rejects other prefixes and a missing image", () => {
    expect(pageImageSchema.safeParse({ image: "data:image/png;base64,iVBOR" }).success).toBe(false);
    expect(pageImageSchema.safeParse({ image: "/9j/4AAQ" }).success).toBe(false);
    expect(pageImageSchema.safeParse({ image: 42 }).success).toBe(false);
    expect(pageImageSchema.safeParse({}).success).toBe(false);
  });

  it("accepts the length cap and rejects one char over", () => {
    const atCap = PAGE_IMAGE_PREFIX + "a".repeat(MAX_PAGE_IMAGE_CHARS - PAGE_IMAGE_PREFIX.length);
    expect(pageImageSchema.safeParse({ image: atCap }).success).toBe(true);
    expect(pageImageSchema.safeParse({ image: `${atCap}a` }).success).toBe(false);
  });
});
