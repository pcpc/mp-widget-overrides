// trip-list.js — Self-contained Web Component for GoMethod trip listings
// No dependencies, no build tools, no Shadow DOM

class TripList extends HTMLElement {

  static API_URL = 'https://data.pcpc.in/mp/go-method-trips.php';
  static CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  static _cache = { data: null, timestamp: 0 };
  static MONTHS_FULL = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  static MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  constructor() {
    super();
    this._cardTemplate = this._buildTemplate();
  }

  connectedCallback() {
    this._abortController = new AbortController();
    this._showLoading();
    this._fetchTrips(this._abortController.signal);
  }

  disconnectedCallback() {
    this._abortController?.abort();
    this._closeModal();
  }

  // ── Template (imperative, no innerHTML) ───────────────────

  _buildTemplate() {
    const tpl = document.createElement('template');

    // Outer column wrapper
    const col = document.createElement('div');
    col.className = 'p-2 md:basis-1/2 lg:basis-1/3';

    // Card container
    const card = document.createElement('div');
    card.className = 'flex h-full flex-1 flex-col overflow-hidden rounded bg-white shadow-lg';

    // Image wrapper
    const imgWrap = document.createElement('div');
    imgWrap.className = 'aspect-[16/9] w-full overflow-hidden';

    const img = document.createElement('img');
    img.className = 'h-full w-full object-cover';
    img.setAttribute('src', '');
    img.setAttribute('alt', '');
    imgWrap.append(img);

    // Content area
    const content = document.createElement('div');
    content.className = 'flex h-full flex-1 flex-col p-3';

    // Title + date group
    const titleGroup = document.createElement('div');
    titleGroup.className = 'flex-shrink-0';

    const h3 = document.createElement('h3');
    h3.className = 'text-lg font-bold leading-tight text-neutral mb-1 heading-card';

    const datePara = document.createElement('p');
    datePara.className = 'mb-2 font-sans text-sm font-semibold uppercase';
    datePara.dataset.date = '';

    titleGroup.append(h3, datePara);

    // Button area
    const btnGroup = document.createElement('div');
    btnGroup.className = 'mt-auto mb-0 flex flex-wrap gap-2';

    const link = document.createElement('a');
    link.className = [
      'no-underline select-none rounded-sm',
      'max-w-full',
      'px-2 py-1 text-input-base gap-2',
      'border-1 border-primary text-primary hover:bg-primary hover:text-white focus:ring-primary',
      'inline-flex items-center justify-center font-bold focus:ring-2 focus:ring-offset-2 focus:outline-none motion-safe:transition'
    ].join(' ');
    link.setAttribute('href', '');

    const span = document.createElement('span');
    span.textContent = 'Learn More';
    link.append(span);

    btnGroup.append(link);
    content.append(titleGroup, btnGroup);
    card.append(imgWrap, content);
    col.append(card);
    tpl.content.append(col);

    return tpl;
  }

  // ── Data fetching with cache ──────────────────────────────

  async _fetchTrips(signal) {
    const now = Date.now();
    const cache = TripList._cache;

    if (cache.data && (now - cache.timestamp) < TripList.CACHE_TTL) {
      this._renderTrips(cache.data);
      return;
    }

    try {
      const response = await fetch(TripList.API_URL, { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const json = await response.json();
      const trips = json?.data?.trips ?? [];

      TripList._cache = { data: trips, timestamp: Date.now() };
      this._renderTrips(trips);
    } catch (err) {
      if (err.name === 'AbortError') return;
      this._renderError(`Failed to load trips: ${err.message}`);
    }
  }

  // ── Rendering ─────────────────────────────────────────────

  _clearChildren() {
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }
  }

  _showLoading() {
    this._clearChildren();
    const p = document.createElement('p');
    p.className = 'text-center text-gray-500 py-8';
    p.textContent = 'Loading trips\u2026';
    this.append(p);
  }

  _renderError(message) {
    this._clearChildren();
    const p = document.createElement('p');
    p.className = 'text-center text-red-600 py-8';
    p.textContent = message;
    this.append(p);
  }

  _renderTrips(trips) {
    this._clearChildren();

    if (trips.length === 0) {
      const p = document.createElement('p');
      p.className = 'text-center text-gray-500 py-8';
      p.textContent = 'No upcoming trips available.';
      this.append(p);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = '-mx-2 flex flex-wrap justify-start';

    for (const trip of trips) {
      wrapper.append(this._createCard(trip));
    }

    this.append(wrapper);
  }

  _createCard(trip) {
    const fragment = this._cardTemplate.content.cloneNode(true);

    const img = fragment.querySelector('img');
    img.setAttribute('src', trip.tripImage?.overviewImageUrl ?? '');
    img.setAttribute('alt', trip.name);

    const h3 = fragment.querySelector('h3');
    h3.textContent = trip.name;

    const datePara = fragment.querySelector('[data-date]');
    datePara.textContent = TripList._formatDateRange(trip.startDate, trip.endDate);

    const link = fragment.querySelector('a');
    link.setAttribute('href', `./?id=${trip.id}`);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      this._showModal(trip);
    });

    return fragment;
  }

  // ── Modal ────────────────────────────────────────────────

  _safeHTML(htmlString) {
    if (!htmlString) return document.createDocumentFragment();
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    const frag = document.createDocumentFragment();
    while (doc.body.firstChild) {
      frag.append(doc.body.firstChild);
    }
    return frag;
  }

  _showModal(trip) {
    this._closeModal();

    // Overlay container
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    overlay.dataset.tripModal = '';

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 bg-black/50';
    backdrop.addEventListener('click', () => this._closeModal());

    // Modal card
    const modal = document.createElement('div');
    modal.className = [
      'relative w-full max-w-2xl max-h-[90vh]',
      'overflow-y-auto rounded-lg bg-white shadow-xl'
    ].join(' ');

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = [
      'absolute top-3 right-3 text-gray-400 hover:text-gray-600',
      'text-2xl leading-none p-1 cursor-pointer'
    ].join(' ');
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => this._closeModal());

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'p-8 pt-10';

    // Trip name
    const title = document.createElement('h2');
    title.className = 'text-3xl text-center font-light';
    title.textContent = trip.name;

    // Date range
    const dateText = document.createElement('p');
    dateText.className = 'text-center text-gray-500 text-lg mt-2';
    dateText.textContent = TripList._formatDateRange(trip.startDate, trip.endDate);

    content.append(title, dateText);

    // Conditional button row
    const showApply = TripList._isRegistrationOpen(
      trip.registrationStartDate,
      trip.registrationEndDate
    );
    const showGive = trip.payStructure === 'DONATION';

    if (showApply || showGive) {
      const btnRow = document.createElement('div');
      btnRow.className = 'flex gap-4 justify-center mt-6';

      if (showApply) {
        const applyLink = document.createElement('a');
        applyLink.className = [
          'inline-flex items-center justify-center',
          'rounded px-6 py-2 text-sm font-semibold',
          'bg-neutral-600 text-white hover:bg-neutral-700',
          'no-underline motion-safe:transition'
        ].join(' ');
        applyLink.setAttribute('href', trip.registrationUrl);
        applyLink.setAttribute('target', '_blank');
        applyLink.setAttribute('rel', 'noopener');
        applyLink.textContent =
          `Apply by ${TripList._formatDate(trip.registrationEndDate)}`;
        btnRow.append(applyLink);
      }

      if (showGive) {
        const giveLink = document.createElement('a');
        giveLink.className = [
          'inline-flex items-center justify-center',
          'rounded px-6 py-2 text-sm font-semibold',
          'border border-neutral-600 text-neutral-600 hover:bg-neutral-100',
          'no-underline motion-safe:transition'
        ].join(' ');
        const fundParam = encodeURIComponent(trip.name);
        giveLink.setAttribute(
          'href',
          `https://pcpc.onlinegiving.org/donate/form/1423?fund=${fundParam}`
        );
        giveLink.setAttribute('target', '_blank');
        giveLink.setAttribute('rel', 'noopener');
        giveLink.textContent = 'Give';
        btnRow.append(giveLink);
      }

      content.append(btnRow);
    }

    // Description (parsed HTML via DOMParser)
    const descWrap = document.createElement('div');
    descWrap.className = 'mt-8 prose max-w-none';
    descWrap.append(this._safeHTML(trip.description));
    content.append(descWrap);

    // Assemble and mount
    modal.append(closeBtn, content);
    overlay.append(backdrop, modal);
    this.append(overlay);

    // Escape key handler
    this._escHandler = (e) => {
      if (e.key === 'Escape') this._closeModal();
    };
    document.addEventListener('keydown', this._escHandler);

    // Lock body scroll
    document.body.style.overflow = 'hidden';
  }

  _closeModal() {
    const overlay = this.querySelector('[data-trip-modal]');
    if (overlay) overlay.remove();
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    document.body.style.overflow = '';
  }

  // ── Date formatting ───────────────────────────────────────

  static _formatDateRange(startStr, endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);

    const sMonth = start.getUTCMonth();
    const sDay = start.getUTCDate();
    const sYear = start.getUTCFullYear();

    const eMonth = end.getUTCMonth();
    const eDay = end.getUTCDate();
    const eYear = end.getUTCFullYear();

    const F = TripList.MONTHS_FULL;
    const S = TripList.MONTHS_SHORT;

    // Cross-year: "Dec 28, 2025 - Jan 4, 2026"
    if (sYear !== eYear) {
      return `${S[sMonth]} ${sDay}, ${sYear} - ${S[eMonth]} ${eDay}, ${eYear}`;
    }

    // Same month: "June 15-18, 2026"
    if (sMonth === eMonth) {
      return `${F[sMonth]} ${sDay}-${eDay}, ${sYear}`;
    }

    // Cross-month, same year: "June 25 - July 5, 2026"
    return `${F[sMonth]} ${sDay} - ${F[eMonth]} ${eDay}, ${sYear}`;
  }

  static _formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${TripList.MONTHS_FULL[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }

  static _isRegistrationOpen(startStr, endStr) {
    if (!startStr || !endStr) return false;
    const now = new Date();
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const start = new Date(startStr);
    const startUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const end = new Date(endStr);
    const endUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    return todayUTC >= startUTC && todayUTC <= endUTC;
  }
}

customElements.define('trip-list', TripList);
