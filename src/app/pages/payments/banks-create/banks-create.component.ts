import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";

import { Observable, Subject, of, from } from "rxjs"; // CHANGE: add `from`
import {
  catchError,
  map,
  startWith,
  switchMap,
  takeUntil,
} from "rxjs/operators";

// Angular Material
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSelectModule } from "@angular/material/select";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import type { MatAutocompleteSelectedEvent } from "@angular/material/autocomplete";

// Services
import { PaymentsService } from "../../../services/payments/payments.service";
import { APIsService } from "../../../services/APIs/apis.service";

// Types
import type { MSG } from "../../../types/api-message.types";
import {
  BankStatus,
  type BankCreateInput,
} from "../../../types/payments/bank-registry/banks/bank.types";

import {
  CountryCurrencyCard,
  CountryCurrencyMapper,
} from "../../../utils/country/country-currency.mapper";

import { ProgressBarComponent } from "../../../components/dialogs/progress-bar/progress-bar.component";
import { NotificationDialogComponent } from "../../../components/dialogs/notificationBar/notificationBar.component";

import type { PhoneNumber } from "../../../types/common";
import type { CountryCodesDto } from "../../../services/auth/user.contract";
import { Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";

// =============================================================================
// Form typing
// =============================================================================
type CreateFormShape = {
  // Country autocomplete
  countryQuery: FormControl<string | CountryCurrencyCard>;
  countryCurrency: FormControl<CountryCurrencyCard | null>;
  countryCca2: FormControl<string>;

  name: FormControl<string>;
  bankCode: FormControl<string>;
  swiftBic: FormControl<string>;

  status: FormControl<BankStatus>; // CHANGE: status is BankStatus, not string

  addressLine1: FormControl<string>;
  addressLine2: FormControl<string>;
  city: FormControl<string>;
  district: FormControl<string>;
  province: FormControl<string>;
  postalCode: FormControl<string>;

  // Phone split fields
  phoneCodeQuery: FormControl<string | CountryCodesDto>; // CHANGE: new - autocomplete input
  phoneCodeSelected: FormControl<CountryCodesDto | null>; // CHANGE: new - selected code
  phoneNumberOnly: FormControl<string>; // CHANGE: new - number only input

  // Final phone object (set on submit)
  phone: FormControl<PhoneNumber | null>; // CHANGE: will be set before payload build

  supportedCurrencyCodes: FormControl<string[]>;
  notes: FormControl<string>;
};

@Component( {
  selector: "app-payment-banks-create",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,

    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatAutocompleteModule,

    NotificationDialogComponent,
    ProgressBarComponent,
  ],
  templateUrl: "./banks-create.component.html",
  styleUrls: [ "./banks-create.component.scss" ],
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class PaymentBanksCreateComponent implements OnInit, OnDestroy {
  @ViewChild( ProgressBarComponent )
  public progressBar!: ProgressBarComponent;

  @ViewChild( NotificationDialogComponent )
  public notificationDialog!: NotificationDialogComponent;

  // ===========================================================================
  // Country/Currency
  // ===========================================================================
  protected allCurrencies: CountryCurrencyCard[] = []; // CHANGE: spelling fix
  protected filteredCountries$: Observable<CountryCurrencyCard[]> = of( [] );

  // ===========================================================================
  // Phone code autocomplete
  // ===========================================================================
  protected allPhoneCodes: CountryCodesDto[] = []; // CHANGE: now store full dto list
  protected filteredPhoneCodes$: Observable<CountryCodesDto[]> = of( [] ); // CHANGE: new filtered stream

  // ===========================================================================
  // UI / State
  // ===========================================================================
  public loading = false;
  public error: string | null = null;

  public readonly createForm: FormGroup<CreateFormShape>;
  public readonly default_status: BankStatus[] = [ BankStatus.Active, BankStatus.Inactive ];

  // ===========================================================================
  // Internals
  // ===========================================================================
  private readonly destroy$ = new Subject<void>();

  // ===========================================================================
  // Constructor
  // ===========================================================================
  public constructor (
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly payments: PaymentsService,
    private readonly apiService: APIsService
  ) {
    this.createForm = this.buildCreateForm();
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  public ngOnInit(): void {
    // CHANGE: avoid async ngOnInit; keep reactive & safe
    // CHANGE: countries load with strict array coercion
    from( this.apiService.getCountriesCurrencies() )
      .pipe(
        takeUntil( this.destroy$ ),
        map( ( raw: unknown ) => this.asArray( raw ) ), // CHANGE: ensure array for mapper input
        catchError( ( err: unknown ) => {
          console.error( "[Error:] [PaymentBanksCreateComponent:] loadCountries failed.\n" );
          this.error = `[Error:] ${ this.errMsg( err ) }\n`;
          return of( [] as unknown[] );
        } )
      )
      .subscribe( ( rawCountriesArr: unknown[] ) => {
        // CHANGE: mapper now receives an array (no TS2345)
        this.allCurrencies = CountryCurrencyMapper.toCurrencyCards( rawCountriesArr );

        this.filteredCountries$ = this.createForm.controls.countryQuery.valueChanges.pipe(
          startWith( this.createForm.controls.countryQuery.value ),
          map( ( v ) => this.normalizeCountryQueryText( v ) ),
          map( ( q ) => this.filterCountriesByText( q ) )
        );
      } );

    // Phone codes load
    from( this.apiService.getCountryCodes() )
      .pipe(
        takeUntil( this.destroy$ ),
        catchError( ( err: unknown ) => {
          console.error( "[Error:] [PaymentBanksCreateComponent:] loadPhoneCodes failed.\n" );
          // Don’t block the whole form; user can still type manually
          this.notificationDialog?.notification( "error", this.errMsg( err ) ?? "Failed to load phone codes" );
          return of( [] as CountryCodesDto[] );
        } )
      )
      .subscribe( ( rows: CountryCodesDto[] ) => {
        this.allPhoneCodes = Array.isArray( rows ) ? rows : [];

        // CHANGE: build filteredPhoneCodes$ stream
        this.filteredPhoneCodes$ = this.createForm.controls.phoneCodeQuery.valueChanges.pipe(
          startWith( this.createForm.controls.phoneCodeQuery.value ),
          map( ( v ) => this.normalizePhoneCodeQueryText( v ) ),
          map( ( q ) => this.filterPhoneCodesByText( q ) )
        );
      } );
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===========================================================================
  // Country autocomplete
  // ===========================================================================
  public displayCountryCard( value: string | CountryCurrencyCard ): string {
    if ( typeof value === "string" ) return value;
    return value?.name ?? "";
  }

  public onCountryOptionSelected( ev: MatAutocompleteSelectedEvent ): void {
    const card = ev.option.value as CountryCurrencyCard | null;
    if ( !card ) return;

    const meta = this.resolveCountryCardMeta( card );
    if ( !meta ) {
      console.warn( "[Warning:] Selected country card missing cca2/currency code.\n" );
      return;
    }

    this.createForm.controls.countryCurrency.setValue( card );
    this.createForm.controls.countryQuery.setValue( card );
    this.createForm.controls.countryCca2.setValue( meta.cca2 );

    // Seed supportedCurrencyCodes
    this.createForm.controls.supportedCurrencyCodes.setValue( [ meta.code ] );
  }

  protected clearCountrySelection(): void {
    this.createForm.controls.countryCurrency.setValue( null );
    this.createForm.controls.countryQuery.setValue( "" );
    this.createForm.controls.countryCca2.setValue( "LK" );
    this.createForm.controls.supportedCurrencyCodes.setValue( [ "LKR" ] );
  }

  // ===========================================================================
  // Phone code autocomplete
  // ===========================================================================
  public displayPhoneCode( value: string | CountryCodesDto ): string {
    // CHANGE: show something readable in input after selection
    if ( typeof value === "string" ) return value;
    const name = this.safeTrim( value?.name );
    const code = this.safeTrim( value?.code );
    return name && code ? `${ name } (${ code })` : name || code || "";
  }

  public onPhoneCodeSelected( ev: MatAutocompleteSelectedEvent ): void {
    const codeDto = ev.option.value as CountryCodesDto | null;
    if ( !codeDto ) return;

    // CHANGE: keep selected + keep query synchronized
    this.createForm.controls.phoneCodeSelected.setValue( codeDto );
    this.createForm.controls.phoneCodeQuery.setValue( codeDto );
  }

  public clearPhoneSelection(): void {
    // CHANGE: helper for UI reset button if you want
    this.createForm.controls.phoneCodeSelected.setValue( null );
    this.createForm.controls.phoneCodeQuery.setValue( "" );
    this.createForm.controls.phoneNumberOnly.setValue( "" );
    this.createForm.controls.phone.setValue( null );
  }

  // ===========================================================================
  // Create + Existence check
  // ===========================================================================
  public submitCreate(): void {
    console.log( 'submit' );
    // CHANGE: build PhoneNumber from split inputs BEFORE validation check
    this.hydratePhoneControlFromSplitInputs();

    this.createForm.markAllAsTouched();
    if ( this.createForm.invalid ) {
      this.error = "[Error:] Please fix validation errors.\n";
      return;
    }

    const payload = this.buildCreatePayload();
    if ( !payload ) {
      this.error = "[Error:] Invalid payload.\n";
      return;
    }

    this.loading = true;
    this.error = null;
    this.progressBar.start();

    this.checkBankExists$( payload )
      .pipe(
        switchMap( ( exists ) => {
          if ( exists ) {
            console.log( exists );
            this.loading = false;
            this.error = "[Error:] Bank already exists for the same country (and identifiers).\n";
            this.progressBar.complete(); // CHANGE: complete progress on early exit
            return of( null );
          }
          return this.payments.banks.create$( payload );
        } ),
        takeUntil( this.destroy$ ),
        catchError( ( err: unknown ) => {
          console.log( err );
          this.loading = false;
          this.error = `[Error:] ${ this.errMsg( err ) }\n`;
          this.notificationDialog.notification( "error", this.errMsg( err ) ?? "Bank creation failed!" );
          this.progressBar.stop(); // CHANGE: stop on error
          return of( null );
        } )
      )
      .subscribe( ( msg: MSG | null ) => {
        console.log( msg );
        if ( !msg ) return;

        this.loading = false;

        if ( !msg.success ) {
          this.error = msg.message || "[Error:] Bank create failed.\n";
          this.notificationDialog.notification( "error", msg.message ?? "Bank create failed!" );
          this.progressBar.stop(); // CHANGE: complete on failure response
          return;
        }

        const keepCard = this.createForm.controls.countryCurrency.value;
        const keepCca2 = this.createForm.controls.countryCca2.value;
        const keepCurrencies = this.createForm.controls.supportedCurrencyCodes.value;

        // CHANGE: phone must reset to null (NOT undefined) to stay strict + predictable
        this.createForm.reset( {
          countryQuery: keepCard ? keepCard : "",
          countryCurrency: keepCard ? keepCard : null,
          countryCca2: keepCca2 || "LK",

          name: "",
          bankCode: "",
          swiftBic: "",
          status: BankStatus.Active,

          addressLine1: "",
          addressLine2: "",
          city: "",
          district: "",
          province: "",
          postalCode: "",

          phoneCodeQuery: "",
          phoneCodeSelected: null,
          phoneNumberOnly: "",
          phone: null,

          supportedCurrencyCodes:
            Array.isArray( keepCurrencies ) && keepCurrencies.length > 0 ? keepCurrencies : [ "LKR" ],
          notes: "",
        } );

        this.error = null;
        this.notificationDialog.notification( "success", msg.message ?? "Bank has created!" );
        this.progressBar.complete();
        this.router.navigate( [ '/dashboard/payments/banks-item', msg.data?.system?.bank?.bankId ] );
      } );
  }

  /**
   * Check if bank exists without loading full list.
   */
  private checkBankExists$( payload: BankCreateInput ): Observable<boolean> {
    const search = this.safeTrim( payload.name );
    const countryCca2 = this.safeUpper( payload.countryCca2 );

    if ( !search || countryCca2.length !== 2 ) return of( false );

    return this.payments.banks
      .list$( {
        page: 1,
        limit: 50,
        onlyActive: false,
        countryCca2,
        search, // CHANGE: align with backend parameter name
      } )
      .pipe(
        map( ( msg: MSG ) => {
          if ( !msg?.success ) return false;
          const rows = this.extractListRows( msg );
          if ( rows.length === 0 ) return false;

          const inName = this.normBankName( payload.name );
          const inCountry = countryCca2;
          const inBankCode = this.safeUpper( payload.bankCode ?? "" );
          const inSwift = this.safeUpper( payload.swiftBic ?? "" );

          for ( const r of rows ) {
            const rec = this.asRecord( r );
            if ( !rec ) continue;

            const name = this.readString( rec[ "name" ] );
            const cca2 = this.readString( rec[ "countryCca2" ] );
            if ( !name || !cca2 ) continue;

            if ( this.normBankName( name ) !== inName ) continue;
            if ( this.safeUpper( cca2 ) !== inCountry ) continue;

            const bankCode = this.safeUpper( this.readString( rec[ "bankCode" ] ) ?? "" );
            const swift = this.safeUpper( this.readString( rec[ "swiftBic" ] ) ?? "" );

            if ( inBankCode && bankCode !== inBankCode ) continue;
            if ( inSwift && swift !== inSwift ) continue;

            return true;
          }
          return false;
        } ),
        catchError( () => of( false ) )
      );
  }

  // ===========================================================================
  // Forms
  // ===========================================================================
  private buildCreateForm(): FormGroup<CreateFormShape> {
    const nn = this.fb.nonNullable;

    return nn.group( {
      countryQuery: nn.control<string | CountryCurrencyCard>( "" ),
      countryCurrency: this.fb.control<CountryCurrencyCard | null>( null ),

      countryCca2: nn.control( "LK", {
        validators: [ Validators.required, Validators.pattern( /^[A-Za-z]{2}$/ ) ],
      } ),

      name: nn.control( "", { validators: [ Validators.required, Validators.minLength( 2 ) ] } ),

      bankCode: nn.control( "" ),
      swiftBic: nn.control( "" ),

      // CHANGE: status uses BankStatus enum; also make it required
      status: nn.control( BankStatus.Active, { validators: [ Validators.required ] } ),

      // CHANGE: address fields are required by your backend contract
      addressLine1: nn.control( "", { validators: [ Validators.required, Validators.minLength( 2 ) ] } ),
      addressLine2: nn.control( "" ),
      city: nn.control( "", { validators: [ Validators.required ] } ),
      district: nn.control( "", { validators: [ Validators.required ] } ),
      province: nn.control( "", { validators: [ Validators.required ] } ),
      postalCode: nn.control( "", { validators: [ Validators.required ] } ),

      // CHANGE: phone split controls
      phoneCodeQuery: nn.control<string | CountryCodesDto>( "" ),
      phoneCodeSelected: this.fb.control<CountryCodesDto | null>(
        null,
        { validators: [ Validators.required ] } // CHANGE: enforce selection from autocomplete
      ),
      phoneNumberOnly: nn.control( "", {
        validators: [ Validators.required, Validators.minLength( 5 ) ],
      } ),

      // Final phone object set during submit
      phone: this.fb.control<PhoneNumber | null>(
        null,
        { validators: [ Validators.required ] } // CHANGE: make invalid phone block the form
      ),

      supportedCurrencyCodes: nn.control( [ "LKR" ], { validators: [ Validators.required ] } ),
      notes: nn.control( "" ),
    } );
  }

  /**
   * Build BankCreateInput while OMITTING optionals if empty.
   */
  private buildCreatePayload(): BankCreateInput | null {
    const name: BankCreateInput[ "name" ] = this.safeTrim( this.createForm.controls.name.value );
    const cca2Raw: BankCreateInput[ "countryCca2" ] = this.safeUpper( this.createForm.controls.countryCca2.value );

    if ( !name ) return null;
    if ( !cca2Raw || cca2Raw.length !== 2 ) return null;

    const bankCode: BankCreateInput[ "bankCode" ] = this.safeTrim( this.createForm.controls.bankCode.value );
    const swiftBic: BankCreateInput[ "swiftBic" ] = this.safeTrim( this.createForm.controls.swiftBic.value );

    const supportedCurrencyCodes: string[] = this.optStrArray( this.createForm.controls.supportedCurrencyCodes.value );

    // CHANGE: status already typed; no string parsing needed
    const status: BankCreateInput[ "status" ] = this.createForm.controls.status.value;

    // CHANGE: address values must read `.value`, not the control object
    const addressLine1: BankCreateInput[ "addressLine1" ] = this.safeTrim( this.createForm.controls.addressLine1.value );
    const addressLine2Raw: string = this.safeTrim( this.createForm.controls.addressLine2.value );
    const city: BankCreateInput[ "city" ] = this.safeTrim( this.createForm.controls.city.value );
    const district: BankCreateInput[ "district" ] = this.safeTrim( this.createForm.controls.district.value );
    const province: BankCreateInput[ "province" ] = this.safeTrim( this.createForm.controls.province.value );
    const postalCode: BankCreateInput[ "postalCode" ] = this.safeTrim( this.createForm.controls.postalCode.value );

    // CHANGE: phone must come from form control `phone.value` (already hydrated)
    const phone: BankCreateInput[ "phone" ] | null = this.createForm.controls.phone.value;
    if ( !phone ) return null;

    // UI rule: at least 1 currency code
    if ( supportedCurrencyCodes.length === 0 ) return null;

    const notes = this.safeTrim( this.createForm.controls.notes.value );

    const base: BankCreateInput = {
      name,
      countryCca2: cca2Raw,
      supportedCurrencyCodes,
      status,

      addressLine1,
      city,
      district,
      province,
      postalCode,
      phone,
    };

    return {
      ...base,
      ...( addressLine2Raw ? { addressLine2: addressLine2Raw } : {} ), // CHANGE: omit if empty
      ...( bankCode ? { bankCode } : {} ),
      ...( swiftBic ? { swiftBic } : {} ),
      ...( notes ? { notes } : {} ), // NOTE: only if your BankCreateInput really supports notes
    };
  }

  /**
   * CHANGE: Assemble PhoneNumber from (phoneCodeSelected OR phoneCodeQuery) + phoneNumberOnly,
   * then set it into createForm.controls.phone.
   */
  private hydratePhoneControlFromSplitInputs(): void {
    const selected = this.createForm.controls.phoneCodeSelected.value;

    // User can type a code manually OR select from list
    const typed = this.createForm.controls.phoneCodeQuery.value;
    const typedDto = this.asCountryCodesDto( typed );

    const best = selected ?? typedDto;
    const numberOnly = this.safeTrim( this.createForm.controls.phoneNumberOnly.value );

    const phone = this.buildPhoneNumber( best, numberOnly );

    this.createForm.controls.phone.setValue( phone ); // set null if invalid
  }

  /**
   * Build the PhoneNumber object expected by backend.
   *
   * @param codeDto
   * - Expected: CountryCodesDto (name, code, flags)
   * - Nullable: if null => returns null
   *
   * @param numberOnly
   * - Expected: user-entered phone number string
   */
  private buildPhoneNumber( codeDto: CountryCodesDto | null, numberOnly: string ): PhoneNumber | null {
    const num = this.safeTrim( numberOnly );
    if ( !num ) return null;

    const dto = codeDto;
    if ( !dto ) return null;

    const name = this.safeTrim( dto.name );
    const code = this.safeTrim( dto.code );

    const flagsRec = this.asRecord( dto.flags );
    const png = this.safeTrim( flagsRec?.[ "png" ] );
    const svg = this.safeTrim( flagsRec?.[ "svg" ] );
    const alt = this.safeTrim( flagsRec?.[ "alt" ] );

    if ( !name || !code ) return null;
    if ( !png || !svg ) return null;

    // exactOptionalPropertyTypes-safe: omit alt unless it has content
    const flags = alt ? { png, svg, alt } : { png, svg };

    return {
      code: { name, code, flags },
      number: num,
    };
  }

  // ===========================================================================
  // Phone autocomplete helpers
  // ===========================================================================
  private normalizePhoneCodeQueryText( value: string | CountryCodesDto ): string {
    if ( typeof value === "string" ) return value.trim();
    const name = this.safeTrim( value?.name );
    const code = this.safeTrim( value?.code );
    return `${ name } ${ code }`.trim();
  }

  private filterPhoneCodesByText( text: string ): CountryCodesDto[] {
    const q = ( text || "" ).trim().toLowerCase();
    if ( !q ) return [ ...this.allPhoneCodes ];

    return this.allPhoneCodes.filter( ( c ) => {
      const name = ( c?.name ?? "" ).toLowerCase();
      const code = ( c?.code ?? "" ).toLowerCase();
      return name.includes( q ) || code.includes( q );
    } );
  }

  private asCountryCodesDto( v: unknown ): CountryCodesDto | null {
    // Accept typed selection OR manual object value
    if ( !v || typeof v !== "object" ) return null;
    const rec = v as Record<string, unknown>;
    const name = this.safeTrim( rec[ "name" ] );
    const code = this.safeTrim( rec[ "code" ] );
    const flags = rec[ "flags" ];
    if ( !name || !code ) return null;
    if ( !flags || typeof flags !== "object" ) return null;
    return v as CountryCodesDto;
  }

  // ===========================================================================
  // Country filter helpers
  // ===========================================================================
  private normalizeCountryQueryText( value: string | CountryCurrencyCard ): string {
    if ( typeof value === "string" ) return value.trim();
    return ( value?.name ?? "" ).trim();
  }

  private filterCountriesByText( text: string ): CountryCurrencyCard[] {
    const q = ( text || "" ).trim().toLowerCase();
    if ( !q ) return [ ...this.allCurrencies ];

    return this.allCurrencies.filter( ( c ) => {
      const name = ( c.name || "" ).toLowerCase();
      const currency = ( c.currency || "" ).toLowerCase();
      return name.includes( q ) || currency.includes( q );
    } );
  }

  private resolveCountryCardMeta( card: CountryCurrencyCard ): { cca2: string; code: string; } | null {
    const cca2 = this.safeUpper( card.cca2 ?? "" );
    const code = this.safeUpper( card.currency ?? "" );

    if ( !cca2 || cca2.length !== 2 ) return null;
    if ( !code ) return null;

    return { cca2, code };
  }

  // ===========================================================================
  // Response parsing (defensive)
  // ===========================================================================
  private extractListRows( msg: MSG ): unknown[] {
    const data = this.asRecord( msg.data );
    if ( !data ) return [];

    const other = this.asRecord( data[ "other" ] );
    if ( other ) {
      const result = this.asRecord( other[ "result" ] );
      if ( result && Array.isArray( result[ "items" ] ) ) return result[ "items" ] as unknown[];
      if ( Array.isArray( other[ "result" ] ) ) return other[ "result" ] as unknown[];
    }

    if ( Array.isArray( data[ "banks" ] ) ) return data[ "banks" ] as unknown[];
    return [];
  }

  // ===========================================================================
  // Safe helpers
  // ===========================================================================
  // CHANGE: helper to make unknown -> unknown[]
  private asArray( v: unknown ): unknown[] {
    return Array.isArray( v ) ? v : [];
  }

  private normBankName( v: string ): string {
    return this.safeUpper( v ).replace( /\s+/g, " " ).trim();
  }

  private asRecord( v: unknown ): Record<string, unknown> | null {
    if ( !v || typeof v !== "object" ) return null;
    return v as Record<string, unknown>;
  }

  private readString( v: unknown ): string | null {
    if ( typeof v !== "string" ) return null;
    const s = v.trim();
    return s ? s : null;
  }

  private safeTrim( v: unknown ): string {
    if ( typeof v !== "string" ) return "";
    return v.trim();
  }

  private safeUpper( v: unknown ): string {
    if ( typeof v !== "string" ) return "";
    return v.trim().toUpperCase();
  }

  private errMsg( err: unknown ): string {
    if(err instanceof HttpErrorResponse) return err.error.message ?? err.message;
    if ( err instanceof Error ) return err.message;
    if ( typeof err === "string" ) return err;
    try {
      return JSON.stringify( err );
    } catch {
      return "Unknown error";
    }
  }

  /**
   * Sanitize a string array (remove HTML, invisible chars, non-text noise).
   */
  private optStrArray( arg: unknown ): string[] {
    if ( !Array.isArray( arg ) || arg.length === 0 ) return [];

    const out: string[] = [];
    const seen = new Set<string>();

    for ( const raw of arg ) {
      if ( typeof raw !== "string" ) continue;

      const cleaned = this.cleanPlainText( raw );
      if ( !cleaned ) continue;

      const key = cleaned.toLowerCase();
      if ( seen.has( key ) ) continue;

      seen.add( key );
      out.push( cleaned );

      if ( out.length >= 200 ) break;
    }

    return out;
  }

  private cleanPlainText( input: string ): string {
    let s = input.trim();
    if ( !s ) return "";

    s = s.replace( /<[^>]*>/g, " " );

    s = s
      .replace( /&nbsp;/gi, " " )
      .replace( /&amp;/gi, "&" )
      .replace( /&lt;/gi, "<" )
      .replace( /&gt;/gi, ">" )
      .replace( /&quot;/gi, '"' )
      .replace( /&#39;/gi, "'" );

    s = s.replace( /[\u0000-\u001F\u007F-\u009F]/g, "" );
    s = s.replace( /[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, "" );

    try {
      s = s.replace( /[^\p{L}\p{N}\p{P}\p{Zs}]/gu, "" );
    } catch {
      s = s.replace( /[^A-Za-z0-9\s.,:;!?'"()\-_/\\[\]{}@#&+*=<>|]/g, "" );
    }

    s = s.replace( /\s+/g, " " ).trim();
    if ( s.length > 300 ) s = s.slice( 0, 300 ).trim();

    return s;
  }
}
