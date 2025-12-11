// Path: src/app/services/text/text.service.ts
import { Injectable } from '@angular/core';
import { TextUtil } from '../../utils/text.util';

@Injectable( { providedIn: 'root' } )
export class TextService {

  /** Expose raw helpers (thin wrapper). */
  public keyToLabel( text: string ): string {
    return TextUtil.keyToLabel( text );
  }

  public normalizeWhitespace( text: string ): string {
    return TextUtil.normalizeWhitespace( text );
  }

  public truncate( text: string, max = 30 ): string {
    return TextUtil.truncate( text, max );
  }

  public isDateLike( value: unknown ): boolean {
    return TextUtil.isDateLike( value );
  }

  public formatDateForCell( value: string | Date ): string {
    return TextUtil.formatDateForCell( value );
  }

  /**
   * Big one: convert arbitrary value into "HTML-ready" display string:
   *  - boolean → "Yes"/"No" (or icons later)
   *  - date-like → formatted date
   *  - object → "Key: Value" per line
   *  - long strings → truncated with ellipsis
   */
  public formatForCell( value: unknown, maxLength = 30 ): string {
    // null/undefined
    if ( value == null ) return '';

    // boolean
    if ( typeof value === 'boolean' ) {
      return value ? 'Yes' : 'No';
    }

    // date-like
    if ( value instanceof Date || TextUtil.isDateLike( value ) ) {
      return TextUtil.formatDateForCell( value as any );
    }

    // object → flatten
    if ( typeof value === 'object' ) {
      const entries = Object.entries( value as Record<string, unknown> )
        .filter( ( [ key ] ) => !key.includes( '_' ) );
      if ( !entries.length ) return '';
      return entries
        .map( ( [ key, v ] ) => `${ TextUtil.keyToLabel( key ) }: ${ String( v ?? '' ) }` )
        .join( '\n' );
    }

    // primitive string/number
    if ( typeof value === 'number' ) {
      return String( value );
    }

    if ( typeof value === 'string' ) {
      const normalized = TextUtil.normalizeWhitespace( value );
      return TextUtil.truncate( normalized, maxLength );
    }

    return String( value );
  }
}
