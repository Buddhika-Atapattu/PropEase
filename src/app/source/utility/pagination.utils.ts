// Example: Path: src/app/source/utility/pagination.util.ts
export class PaginationUtil {

  public static safeIndex(index: number, total: number): number {
    try {
      // Validate total count
      if(
        Number.isNaN(total) ||
        !Number.isFinite(total) ||
        !Number.isInteger(total) ||
        total < 0
      ) {
        throw new Error('Invalid total count');
      }

      // No items: always 0
      if(total === 0) {
        return 0;
      }

      // Validate index
      if(
        Number.isNaN(index) ||
        !Number.isFinite(index) ||
        !Number.isInteger(index)
      ) {
        throw new Error('Invalid index');
      }

      // Clamp to [0, total - 1]
      if(index < 0) {
        return 0;
      }
      if(index >= total) {
        return total - 1;
      }

      return index;
    } catch(error) {
      console.error('safeIndex error:', error);
      // Fallback to 0 (first index) → safe for most UIs
      return 0;
    }
  }

  public static safeLimit(limit: number, total: number): number {
    try {
      // Validate total count
      if(
        Number.isNaN(total) ||
        !Number.isFinite(total) ||
        !Number.isInteger(total) ||
        total < 0
      ) {
        throw new Error('Invalid total count');
      }

      // No items: no need to fetch anything
      if(total === 0) {
        return 0;
      }

      // Validate limit
      if(
        Number.isNaN(limit) ||
        !Number.isFinite(limit) ||
        !Number.isInteger(limit)
      ) {
        throw new Error('Invalid limit');
      }

      // Optional: enforce a minimum page size of 1
      if(limit < 1) {
        return 1;
      }

      // Clamp to [1, total] so you never request more than available
      if(limit > total) {
        return total;
      }

      return limit;
    } catch(error) {
      console.error('safeLimit error:', error);
      // Fallback: single item per page is safest
      return total > 0 ? 1 : 0;
    }
  }
}
