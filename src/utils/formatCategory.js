/**
 * Format category name for display
 * Replaces hyphens with spaces
 *
 * Examples:
 *   Home & Automation -> Home & Automation
 *   home-automation -> home automation
 *   API-Gateway -> API Gateway
 */
export function formatCategoryName(category) {
  if (!category) return ''

  return category.replace(/-/g, ' ')
}
