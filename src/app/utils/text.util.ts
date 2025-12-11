// Path: src/app/utils/text.util.ts
// ============================================================================
// TextUtil (static class)
//
// Purpose:
//   Centralises all formatting logic used across PropEase:
//     • key → label transform (user_name -> "User Name")
//     • whitespace cleanup
//     • truncate with ellipsis
//     • date detection + formatting
//     • object → "Key: Value" flattening
//
// Notes:
//   - 100% pure static utilities (no Angular, no DOM required).
//   - Fully SSR/Electron-safe.
//   - No side effects; all functions return new values.
// ============================================================================

export class TextUtil {

  // ---------------------------------------------------------------------------
  // Basic Normalisation
  // ---------------------------------------------------------------------------

  /** Collapse multiple spaces/tabs/newlines into a single space. */
  public static normalizeWhitespace( text: unknown ): string {
    if ( typeof text !== 'string' ) return '';
    return text.replace( /\s+/g, ' ' ).trim();
  }

  /** Capitalise first letter, lower-case the rest. */
  public static toCapitalised( word: string ): string {
    if ( !word ) return '';
    return word.charAt( 0 ).toUpperCase() + word.slice( 1 ).toLowerCase();
  }


  // ---------------------------------------------------------------------------
  // Label Builder (key → Label)
  // ---------------------------------------------------------------------------

  /**
   * Convert:
   *   "user_name-id" → "User Name Id"
   *   "tenantMoveOut" → "Tenant Move Out"
   */
  public static keyToLabel( raw: unknown ): string {
    if ( typeof raw !== 'string' ) return '';
    const text = raw.trim();
    if ( !text ) return '';

    // Split by ALL non-alphanumeric separators AND camelCase
    const parts = text
      .replace( /([a-z])([A-Z])/g, '$1 $2' )     // camelCase → camel Case
      .split( /[^a-zA-Z0-9]+/ )                  // underscores / dashes / spaces
      .filter( Boolean );

    if ( !parts.length ) return '';

    return parts.map( TextUtil.toCapitalised ).join( ' ' );
  }


  // ---------------------------------------------------------------------------
  // Date Detection & Formatting
  // ---------------------------------------------------------------------------

  /** Returns TRUE if a value looks like a valid date string or Date object. */
  public static isDateLike( value: unknown ): value is string | Date {
    if ( value instanceof Date ) return !isNaN( value.getTime() );
    if ( typeof value !== 'string' ) return false;

    const ts = Date.parse( value.trim() );
    return Number.isFinite( ts );
  }

  /** Format date as: YYYY/MM/DD – hh:mm AM/PM */
  public static formatDateForCell( value: string | Date ): string {
    const date = value instanceof Date ? value : new Date( value );
    if ( isNaN( date.getTime() ) ) return '';

    const yyyy = date.getFullYear();
    const mm = String( date.getMonth() + 1 ).padStart( 2, '0' );
    const dd = String( date.getDate() ).padStart( 2, '0' );

    let hh = date.getHours();
    const mins = String( date.getMinutes() ).padStart( 2, '0' );
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;

    return `${ yyyy }/${ mm }/${ dd } – ${ String( hh ).padStart( 2, '0' ) }:${ mins } ${ ampm }`;
  }


  // ---------------------------------------------------------------------------
  // String Length Helpers
  // ---------------------------------------------------------------------------

  /** Truncate long text with ellipsis. */
  public static truncate( text: unknown, max = 30 ): string {
    if ( typeof text !== 'string' ) return '';
    const trimmed = text.trim();
    if ( trimmed.length <= max ) return trimmed;
    return trimmed.slice( 0, max - 1 ) + '…';
  }


  // ---------------------------------------------------------------------------
  // Object → "Key: Value" Formatter
  // ---------------------------------------------------------------------------

  /**
   * Flatten objects into readable lines:
   *   {firstName: "John", age: 30}
   * → "First Name: John\nAge: 30"
   */
  public static flattenObject( obj: Record<string, unknown> ): string {
    const lines: string[] = [];

    for ( const [ key, value ] of Object.entries( obj ) ) {
      if ( key.includes( '_' ) ) continue; // skip system fields

      const label = TextUtil.keyToLabel( key );
      const val =
        value instanceof Date || TextUtil.isDateLike( value )
          ? TextUtil.formatDateForCell( value as any )
          : typeof value === 'object'
            ? JSON.stringify( value )
            : String( value ?? '' );

      lines.push( `${ label }: ${ val }` );
    }

    return lines.join( '\n' );
  }


  // ---------------------------------------------------------------------------
  // MASTER FORMATTER → For Table Cells or General Display
  // ---------------------------------------------------------------------------

  /**
   * Convert ANY unknown value into a final safe, readable string:
   *  • boolean → "Yes"/"No"
   *  • date → formatted
   *  • object → flatten
   *  • string → trimmed + truncated
   *  • number → String(number)
   */
  public static formatForCell( value: unknown, maxLength = 30 ): string {
    if ( value == null ) return '';

    // Boolean format
    if ( typeof value === 'boolean' ) return value ? 'Yes' : 'No';

    // Date-like
    if ( value instanceof Date || TextUtil.isDateLike( value ) ) {
      return TextUtil.formatDateForCell( value as any );
    }

    // Object map
    if ( typeof value === 'object' ) {
      return TextUtil.flattenObject( value as Record<string, unknown> );
    }

    // Number
    if ( typeof value === 'number' ) return String( value );

    // Text
    if ( typeof value === 'string' ) {
      const normalized = TextUtil.normalizeWhitespace( value );
      return TextUtil.truncate( normalized, maxLength );
    }

    return String( value );
  }
}
