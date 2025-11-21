/**
 * Dynamic Schema Generator
 * Generates Mongoose schemas for ALL possible languages (not just enabled)
 * Runtime validation checks if language is enabled
 */

import { Schema } from "mongoose";
import { LanguageModel } from "./models/language";

/**
 * Get all language codes (enabled + disabled) for schema generation
 * Schemas include all languages, but runtime validation checks isEnabled
 */
export const getAllLanguageCodesForSchema = async (): Promise<string[]> => {
  const languages = await LanguageModel.find().select("code").lean();
  return languages.map(l => l.code);
};

/**
 * Create multilingual text schema for ALL languages
 * This allows languages to be enabled/disabled without schema changes
 */
export const createMultilingualTextSchema = async () => {
  const schema: Record<string, any> = {};
  const languageCodes = await getAllLanguageCodesForSchema();

  languageCodes.forEach(code => {
    schema[code] = { type: String };
  });

  return schema;
};

/**
 * Create features schema (array of strings per language)
 */
export const createFeaturesSchema = async () => {
  const schema: Record<string, any> = {};
  const languageCodes = await getAllLanguageCodesForSchema();

  languageCodes.forEach(code => {
    schema[code] = [{ type: String }];
  });

  return schema;
};

/**
 * Create specifications schema (structured array per language)
 */
export const createSpecificationsSchema = async () => {
  const schema: Record<string, any> = {};
  const languageCodes = await getAllLanguageCodesForSchema();

  const specSchema = [
    {
      key: { type: String, required: true },
      label: { type: String, required: true },
      value: { type: Schema.Types.Mixed, required: true },
      uom: { type: String },
      category: { type: String },
      order: { type: Number },
    },
  ];

  languageCodes.forEach(code => {
    schema[code] = specSchema;
  });

  return schema;
};

/**
 * Create attributes schema (structured array per language)
 */
export const createAttributesSchema = async () => {
  const schema: Record<string, any> = {};
  const languageCodes = await getAllLanguageCodesForSchema();

  const attrSchema = [
    {
      key: { type: String, required: true },
      label: { type: String, required: true },
      value: { type: Schema.Types.Mixed, required: true },
    },
  ];

  languageCodes.forEach(code => {
    schema[code] = attrSchema;
  });

  return schema;
};

/**
 * Generate all schemas - called at application startup
 * Includes ALL languages (enabled + disabled) so schemas don't need to change
 * Runtime validation checks if language is enabled
 */
export const generateProductSchemas = async () => {
  const [
    multilingualText,
    features,
    specifications,
    attributes,
    languageCodes
  ] = await Promise.all([
    createMultilingualTextSchema(),
    createFeaturesSchema(),
    createSpecificationsSchema(),
    createAttributesSchema(),
    getAllLanguageCodesForSchema()
  ]);

  return {
    MultilingualTextSchema: multilingualText,
    FeaturesSchema: features,
    SpecificationsSchema: specifications,
    AttributesSchema: attributes,
    languageCodes, // All language codes for schema
  };
};
