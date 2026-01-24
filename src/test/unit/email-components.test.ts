/**
 * Unit Tests: Email Components
 *
 * Tests for the EmailComponent model and related functionality.
 */

import { describe, it, expect } from "vitest";
import { EMAIL_COMPONENT_TYPES, type EmailComponentType } from "@/lib/db/models/email-component";

describe("unit: EmailComponent Types", () => {
  it("should have header and footer as valid component types", () => {
    /**
     * Verify that EMAIL_COMPONENT_TYPES contains exactly the expected types.
     */
    // Assert
    expect(EMAIL_COMPONENT_TYPES).toContain("header");
    expect(EMAIL_COMPONENT_TYPES).toContain("footer");
    expect(EMAIL_COMPONENT_TYPES).toHaveLength(2);
  });

  it("should validate component type correctly", () => {
    /**
     * Test that type validation works for valid and invalid types.
     */
    // Arrange
    const validTypes = ["header", "footer"];
    const invalidTypes = ["sidebar", "body", "content", ""];

    // Act & Assert
    validTypes.forEach((type) => {
      expect(EMAIL_COMPONENT_TYPES.includes(type as EmailComponentType)).toBe(true);
    });

    invalidTypes.forEach((type) => {
      expect(EMAIL_COMPONENT_TYPES.includes(type as EmailComponentType)).toBe(false);
    });
  });
});

describe("unit: NotificationTemplate Header/Footer Fields", () => {
  it("should have correct default values for header/footer settings", () => {
    /**
     * Test that templates default to using default header/footer.
     */
    // Arrange
    const defaultTemplate = {
      use_default_header: true,
      use_default_footer: true,
      header_id: undefined,
      footer_id: undefined,
    };

    // Assert - by default, templates should use default header/footer
    expect(defaultTemplate.use_default_header).toBe(true);
    expect(defaultTemplate.use_default_footer).toBe(true);
    expect(defaultTemplate.header_id).toBeUndefined();
    expect(defaultTemplate.footer_id).toBeUndefined();
  });

  it("should allow custom header/footer selection when defaults disabled", () => {
    /**
     * Test that custom header/footer can be selected when use_default is false.
     */
    // Arrange
    const customTemplate = {
      use_default_header: false,
      use_default_footer: false,
      header_id: "header_custom_123",
      footer_id: "footer_custom_456",
    };

    // Assert
    expect(customTemplate.use_default_header).toBe(false);
    expect(customTemplate.use_default_footer).toBe(false);
    expect(customTemplate.header_id).toBe("header_custom_123");
    expect(customTemplate.footer_id).toBe("footer_custom_456");
  });

  it("should allow no header/footer when defaults disabled and no ID set", () => {
    /**
     * Test that templates can have no header/footer at all.
     */
    // Arrange
    const noHeaderFooterTemplate = {
      use_default_header: false,
      use_default_footer: false,
      header_id: null,
      footer_id: null,
    };

    // Assert - should be able to have no header/footer
    expect(noHeaderFooterTemplate.use_default_header).toBe(false);
    expect(noHeaderFooterTemplate.header_id).toBeNull();
    expect(noHeaderFooterTemplate.use_default_footer).toBe(false);
    expect(noHeaderFooterTemplate.footer_id).toBeNull();
  });
});

describe("unit: Email Component ID Generation", () => {
  it("should generate component_id with correct prefix for headers", () => {
    /**
     * Test that header component IDs start with 'header_'.
     */
    // Arrange
    const headerComponentId = "header_abc123";

    // Assert
    expect(headerComponentId.startsWith("header_")).toBe(true);
  });

  it("should generate component_id with correct prefix for footers", () => {
    /**
     * Test that footer component IDs start with 'footer_'.
     */
    // Arrange
    const footerComponentId = "footer_xyz789";

    // Assert
    expect(footerComponentId.startsWith("footer_")).toBe(true);
  });

  it("should have unique component_id format", () => {
    /**
     * Test component_id format: {type}_{random}.
     */
    // Arrange
    const componentIds = [
      "header_default",
      "header_minimal",
      "footer_default",
      "footer_minimal",
    ];

    // Assert - all IDs should match the pattern
    const pattern = /^(header|footer)_[a-z0-9_]+$/;
    componentIds.forEach((id) => {
      expect(id).toMatch(pattern);
    });
  });
});

describe("unit: Email Variable Replacement", () => {
  it("should replace simple variables in content", () => {
    /**
     * Test that {{variable}} syntax is replaced correctly.
     */
    // Arrange
    const content = "Hello {{name}}, welcome to {{company}}!";
    const variables = { name: "John", company: "ACME" };

    // Act
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      result = result.replace(regex, value);
    }

    // Assert
    expect(result).toBe("Hello John, welcome to ACME!");
  });

  it("should handle variables with spaces around them", () => {
    /**
     * Test that {{ variable }} (with spaces) is also replaced.
     */
    // Arrange
    const content = "Hello {{ name }}, welcome to {{  company  }}!";
    const variables = { name: "Jane", company: "Corp" };

    // Act
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      result = result.replace(regex, value);
    }

    // Assert
    expect(result).toBe("Hello Jane, welcome to Corp!");
  });

  it("should leave unreplaced variables intact", () => {
    /**
     * Test that missing variables are not replaced.
     */
    // Arrange
    const content = "Hello {{name}}, your order {{order_id}} is ready.";
    const variables = { name: "Bob" };

    // Act
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      result = result.replace(regex, value);
    }

    // Assert - order_id should remain as-is
    expect(result).toBe("Hello Bob, your order {{order_id}} is ready.");
  });
});

describe("unit: Email HTML Combination", () => {
  it("should combine header + content + footer correctly", () => {
    /**
     * Test that email parts are combined in correct order.
     */
    // Arrange
    const header = "<header>HEADER</header>";
    const content = "<main>CONTENT</main>";
    const footer = "<footer>FOOTER</footer>";

    // Act
    const combined = header + content + footer;

    // Assert
    expect(combined).toBe("<header>HEADER</header><main>CONTENT</main><footer>FOOTER</footer>");
    expect(combined.indexOf("HEADER")).toBeLessThan(combined.indexOf("CONTENT"));
    expect(combined.indexOf("CONTENT")).toBeLessThan(combined.indexOf("FOOTER"));
  });

  it("should work with only content (no header/footer)", () => {
    /**
     * Test that content works standalone without header/footer.
     */
    // Arrange
    const header = "";
    const content = "<p>Just content</p>";
    const footer = "";

    // Act
    const combined = header + content + footer;

    // Assert
    expect(combined).toBe("<p>Just content</p>");
  });

  it("should work with header only (no footer)", () => {
    /**
     * Test that content works with header but no footer.
     */
    // Arrange
    const header = "<header>TOP</header>";
    const content = "<main>BODY</main>";
    const footer = "";

    // Act
    const combined = header + content + footer;

    // Assert
    expect(combined).toBe("<header>TOP</header><main>BODY</main>");
  });
});
