/* ════════════════════════════════════════════════════════════════
   FinFlow · Data Adapter Layer
   ────────────────────────────────────────────────────────────────
   The single abstraction the rest of app.js calls.
   Three implementations:
     • LocalStorageAdapter — current behavior, anonymous mode
     • SupabaseAdapter     — pure cloud (when authed and online)
     • HybridAdapter       — cache + queue + cloud (production)

   Refactor app.js to call adapter.* methods only.
   Once that's done, swapping LocalStorage → Supabase is a one-line
   change in init().
   ════════════════════════════════════════════════════════════════ */

'use strict';

// ── Event bus for adapters to push updates back to the app ────
class Emitter {
  constructor() { this.listeners = {}; }
  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  emit(evt, payload) { (this.listeners[evt] || []).forEach(fn => fn(payload)); }
}

// ════════════════════════════════════════════════════════════════
// BASE INTERFACE — every adapter implements this
// ════════════════════════════════════════════════════════════════
class DataAdapter extends Emitter {
  // ── auth / session ──────────────────────────────────────────
  async getSession()                           { throw new Error('not impl'); }
  async signUp(email, password, displayName)   { throw new Error('not impl'); }
  async signIn(email, password)                { throw new Error('not impl'); }
  async signInMagicLink(email)                 { throw new Error('not impl'); }
  async signOut()                              { throw new Error('not impl'); }
  async getProfile()                           { throw new Error('not impl'); }
  async updateProfile(patch)                   { throw new Error('not impl'); }

  // ── households ──────────────────────────────────────────────
  async listHouseholds()                       { throw new Error('not impl'); }
  async createHousehold(name, type)            { throw new Error('not impl'); }
  async getHousehold(id)                       { throw new Error('not impl'); }
  async updateHousehold(id, patch)             { throw new Error('not impl'); }
  async deleteHousehold(id)                    { throw new Error('not impl'); }

  // ── memberships ─────────────────────────────────────────────
  async listMemberships(householdId)           { throw new Error('not impl'); }
  async addMember(householdId, member)         { throw new Error('not impl'); }
  async updateMember(memberId, patch)          { throw new Error('not impl'); }
  async removeMember(memberId)                 { throw new Error('not impl'); }
  async transferOwnership(householdId, toUserId) { throw new Error('not impl'); }

  // ── invitations ─────────────────────────────────────────────
  async listInvitations(householdId)           { throw new Error('not impl'); }
  async createInvitation(householdId, email, role, householdRole) { throw new Error('not impl'); }
  async acceptInvitation(token)                { throw new Error('not impl'); }
  async revokeInvitation(invitationId)         { throw new Error('not impl'); }

  // ── domain (transactions/budgets/goals/debts/assets) ────────
  // Generic CRUD — entity is one of: 'transactions','budgets','goals','debts','assets'
  async list(entity, householdId, filters)     { throw new Error('not impl'); }
  async upsert(entity, householdId, record)    { throw new Error('not impl'); }
  async remove(entity, householdId, id)        { throw new Error('not impl'); }
  async replaceAll(entity, householdId, recs)  { throw new Error('not impl'); }

  // ── exchange rates ──────────────────────────────────────────
  async getRates(householdId)                  { throw new Error('not impl'); }
  async upsertRate(householdId, code, rate)    { throw new Error('not impl'); }

  // ── realtime sync ───────────────────────────────────────────
  subscribe(householdId, onChange)             { /* optional */ }
  unsubscribe(householdId)                     { /* optional */ }
}

// ════════════════════════════════════════════════════════════════
// IMPL 1 · LocalStorageAdapter
// Faithful replica of today's behavior. Anonymous mode = always
// uses this. After signin, the HybridAdapter delegates to this
// for the cache layer.
// ════════════════════════════════════════════════════════════════
class LocalStorageAdapter extends DataAdapter {
  constructor() {
    super();
    this.STORE_PREFIX = 'ff_';
    // Single anonymous household for backward compatibility
    this.ANON_HOUSEHOLD_ID = 'local';
  }

  // Storage key helpers
  // For the anonymous household, use legacy v4 keys (ff_transactions, ff_budgets, …)
  // so existing data survives the refactor untouched.
  // For named households (post-auth), use ff_<householdId>_<entity>.
  _key(suffix, householdId = this.ANON_HOUSEHOLD_ID) {
    if (householdId === this.ANON_HOUSEHOLD_ID) {
      return `${this.STORE_PREFIX}${suffix}`;
    }
    return `${this.STORE_PREFIX}${householdId}_${suffix}`;
  }
  _read(suffix, householdId, fallback = []) {
    try { return JSON.parse(localStorage.getItem(this._key(suffix, householdId)) ?? '') ?? fallback; }
    catch { return fallback; }
  }
  _write(suffix, householdId, value) {
    localStorage.setItem(this._key(suffix, householdId), JSON.stringify(value));
  }
  _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

  // ── auth (anonymous mode — synthesize a single local user) ──
  async getSession() {
    const profile = this._read('profile', this.ANON_HOUSEHOLD_ID, null);
    return profile ? { user: { id: 'local-user', email: profile.email || null }, anonymous: true } : null;
  }
  async signUp() { throw new Error('Sign-up requires SupabaseAdapter'); }
  async signIn() { throw new Error('Sign-in requires SupabaseAdapter'); }
  async signOut() { return true; }
  async getProfile() {
    return this._read('profile', this.ANON_HOUSEHOLD_ID, {
      name: '', email: '', baseCurrency: 'USD', language: 'en',
      dateFormat: 'us', payoffStrategy: 'avalanche', extraPayment: 0,
    });
  }
  async updateProfile(patch) {
    const cur = await this.getProfile();
    const next = { ...cur, ...patch };
    this._write('profile', this.ANON_HOUSEHOLD_ID, next);
    this.emit('profile:changed', next);
    return next;
  }

  // ── households / profiles (v5: real local multi-profile) ────
  // Stored under `ff_profiles_list` and `ff_active_profile`.
  // The default 'local' profile is always present (legacy compat).
  async listHouseholds() {
    const list = JSON.parse(localStorage.getItem('ff_profiles_list') || 'null');
    if (!list) {
      // First-run: create the legacy anonymous profile entry
      const def = [{ id: this.ANON_HOUSEHOLD_ID, name: 'My Household', type: 'family', baseCurrency: 'USD', createdAt: new Date().toISOString() }];
      localStorage.setItem('ff_profiles_list', JSON.stringify(def));
      return def;
    }
    return list;
  }
  async createHousehold(name, type = 'personal', baseCurrency = 'USD') {
    const list = await this.listHouseholds();
    const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const profile = { id, name, type, baseCurrency, createdAt: new Date().toISOString() };
    list.push(profile);
    localStorage.setItem('ff_profiles_list', JSON.stringify(list));
    this.emit('households:changed', {});
    return profile;
  }
  async getHousehold(id) {
    const list = await this.listHouseholds();
    return list.find(h => h.id === id);
  }
  async updateHousehold(id, patch) {
    const list = await this.listHouseholds();
    const idx = list.findIndex(h => h.id === id);
    if (idx < 0) throw new Error('Household not found');
    list[idx] = { ...list[idx], ...patch };
    localStorage.setItem('ff_profiles_list', JSON.stringify(list));
    this.emit('households:changed', {});
    return list[idx];
  }
  async deleteHousehold(id) {
    if (id === this.ANON_HOUSEHOLD_ID) throw new Error('Cannot delete the default profile');
    // Wipe all keyed data for this household
    const entities = ['transactions','budgets','goals','members','debts','assets','rates','profile'];
    entities.forEach(e => localStorage.removeItem(this._key(e, id)));
    const list = (await this.listHouseholds()).filter(h => h.id !== id);
    localStorage.setItem('ff_profiles_list', JSON.stringify(list));
    this.emit('households:changed', {});
    return true;
  }
  async getActiveHousehold() {
    return localStorage.getItem('ff_active_profile') || this.ANON_HOUSEHOLD_ID;
  }
  async setActiveHousehold(id) {
    localStorage.setItem('ff_active_profile', id);
    this.emit('active:changed', { id });
    return id;
  }

  // ── memberships ─────────────────────────────────────────────
  async listMemberships(householdId) {
    return this._read('members', householdId);
  }
  async addMember(householdId, m) {
    const list = await this.listMemberships(householdId);
    const next = { id: m.id || this._uid(), ...m };
    list.push(next);
    this._write('members', householdId, list);
    this.emit('members:changed', { householdId });
    return next;
  }
  async updateMember(memberId, patch) {
    const list = this._read('members', this.ANON_HOUSEHOLD_ID);
    const idx = list.findIndex(m => m.id === memberId);
    if (idx < 0) throw new Error('Member not found');
    list[idx] = { ...list[idx], ...patch };
    this._write('members', this.ANON_HOUSEHOLD_ID, list);
    this.emit('members:changed', { householdId: this.ANON_HOUSEHOLD_ID });
    return list[idx];
  }
  async removeMember(memberId) {
    const list = this._read('members', this.ANON_HOUSEHOLD_ID);
    this._write('members', this.ANON_HOUSEHOLD_ID, list.filter(m => m.id !== memberId));
    this.emit('members:changed', { householdId: this.ANON_HOUSEHOLD_ID });
    return true;
  }
  async transferOwnership() { throw new Error('Not applicable in anonymous mode'); }

  // ── invitations (no-op locally) ─────────────────────────────
  async listInvitations() { return []; }
  async createInvitation() { throw new Error('Invitations require SupabaseAdapter'); }
  async acceptInvitation() { throw new Error('Invitations require SupabaseAdapter'); }
  async revokeInvitation() { return true; }

  // ── domain CRUD ─────────────────────────────────────────────
  async list(entity, householdId, filters = {}) {
    let rows = this._read(entity, householdId);
    if (filters.from) rows = rows.filter(r => (r.date || '') >= filters.from);
    if (filters.to)   rows = rows.filter(r => (r.date || '') <= filters.to);
    if (filters.type) rows = rows.filter(r => r.type === filters.type);
    if (filters.category) rows = rows.filter(r => r.category === filters.category);
    if (filters.memberId) rows = rows.filter(r => r.memberId === filters.memberId);
    return rows;
  }
  async upsert(entity, householdId, record) {
    const list = this._read(entity, householdId);
    const id = record.id || this._uid();
    const next = { ...record, id, updated_at: new Date().toISOString() };
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) list[idx] = next;
    else list.push(next);
    this._write(entity, householdId, list);
    this.emit(`${entity}:changed`, { householdId });
    return next;
  }
  async remove(entity, householdId, id) {
    const list = this._read(entity, householdId);
    this._write(entity, householdId, list.filter(r => r.id !== id));
    this.emit(`${entity}:changed`, { householdId });
    return true;
  }
  async replaceAll(entity, householdId, records) {
    this._write(entity, householdId, records || []);
    this.emit(`${entity}:changed`, { householdId });
    return records;
  }

  // ── exchange rates ──────────────────────────────────────────
  async getRates(householdId) {
    return this._read('rates', householdId, {});
  }
  async upsertRate(householdId, code, rate) {
    const rates = await this.getRates(householdId);
    rates[code] = rate;
    this._write('rates', householdId, rates);
    return rates;
  }

  // No realtime in local mode
  subscribe() {}
  unsubscribe() {}
}

// ════════════════════════════════════════════════════════════════
// IMPL 2 · SupabaseAdapter
// Pure cloud. Use after auth, when online. The Hybrid wraps this.
//
// Requires loading @supabase/supabase-js v2 via:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
//
// Then construct with:
//   const sb = supabase.createClient('https://xxx.supabase.co', 'eyJ...anon-key');
//   const adapter = new SupabaseAdapter(sb);
// ════════════════════════════════════════════════════════════════
class SupabaseAdapter extends DataAdapter {
  constructor(supabaseClient) {
    super();
    this.sb = supabaseClient;
    this._channels = new Map();
    // Auto-emit on auth state changes
    this.sb.auth.onAuthStateChange((event, session) => {
      this.emit('auth:changed', { event, session });
    });
  }

  // ── auth ────────────────────────────────────────────────────
  async getSession() {
    const { data } = await this.sb.auth.getSession();
    return data.session;
  }
  async signUp(email, password, displayName) {
    const { data, error } = await this.sb.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } }
    });
    if (error) throw error;
    return data;
  }
  async signIn(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }
  async signInMagicLink(email) {
    const { error } = await this.sb.auth.signInWithOtp({ email });
    if (error) throw error;
  }
  async signOut() {
    const { error } = await this.sb.auth.signOut();
    if (error) throw error;
  }
  async getProfile() {
    const session = await this.getSession();
    if (!session) return null;
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', session.user.id).single();
    if (error) throw error;
    return data;
  }
  async updateProfile(patch) {
    const session = await this.getSession();
    const { data, error } = await this.sb.from('profiles').update(patch).eq('id', session.user.id).select().single();
    if (error) throw error;
    this.emit('profile:changed', data);
    return data;
  }

  // ── households ──────────────────────────────────────────────
  async listHouseholds() {
    // Uses the my_households view we created in schema.sql
    const { data, error } = await this.sb.from('my_households').select('*').order('created_at');
    if (error) throw error;
    return data;
  }
  async createHousehold(name, type = 'family') {
    const session = await this.getSession();
    const { data, error } = await this.sb.from('households').insert({
      name, type, created_by: session.user.id
    }).select().single();
    if (error) throw error;
    return data;
  }
  async getHousehold(id) {
    const { data, error } = await this.sb.from('households').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }
  async updateHousehold(id, patch) {
    const { data, error } = await this.sb.from('households').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
  async deleteHousehold(id) {
    const { error } = await this.sb.from('households').delete().eq('id', id);
    if (error) throw error;
  }

  // ── memberships ─────────────────────────────────────────────
  async listMemberships(householdId) {
    const { data, error } = await this.sb.from('memberships')
      .select('*, profiles(display_name, avatar_url)')
      .eq('household_id', householdId);
    if (error) throw error;
    return data;
  }
  async addMember(householdId, m) {
    // Direct add (for non-authed members). For authed users → use invitations.
    const { data, error } = await this.sb.from('memberships').insert({
      household_id: householdId, ...m
    }).select().single();
    if (error) throw error;
    return data;
  }
  async updateMember(memberId, patch) {
    const { data, error } = await this.sb.from('memberships').update(patch).eq('id', memberId).select().single();
    if (error) throw error;
    return data;
  }
  async removeMember(memberId) {
    const { error } = await this.sb.from('memberships').delete().eq('id', memberId);
    if (error) throw error;
  }
  async transferOwnership(householdId, toUserId) {
    // RPC for atomic role swap (define this server-side)
    const { error } = await this.sb.rpc('transfer_ownership', { h_id: householdId, to_user: toUserId });
    if (error) throw error;
  }

  // ── invitations ─────────────────────────────────────────────
  async listInvitations(householdId) {
    const { data, error } = await this.sb.from('invitations')
      .select('*').eq('household_id', householdId).is('accepted_at', null);
    if (error) throw error;
    return data;
  }
  async createInvitation(householdId, email, role, householdRole) {
    const session = await this.getSession();
    const { data, error } = await this.sb.from('invitations').insert({
      household_id: householdId, invited_email: email, invited_by: session.user.id,
      role, household_role: householdRole,
    }).select().single();
    if (error) throw error;
    // Trigger Edge Function to send email
    await this.sb.functions.invoke('send-invite-email', { body: { invitationId: data.id } });
    return data;
  }
  async acceptInvitation(token) {
    // Server-side RPC: validates token, creates membership, marks invitation accepted
    const { data, error } = await this.sb.rpc('accept_invitation', { invite_token: token });
    if (error) throw error;
    return data;
  }
  async revokeInvitation(invitationId) {
    const { error } = await this.sb.from('invitations').delete().eq('id', invitationId);
    if (error) throw error;
  }

  // ── domain CRUD ─────────────────────────────────────────────
  async list(entity, householdId, filters = {}) {
    let q = this.sb.from(entity).select('*').eq('household_id', householdId).is('deleted_at', null);
    if (filters.from) q = q.gte('date', filters.from);
    if (filters.to)   q = q.lte('date', filters.to);
    if (filters.type) q = q.eq('type', filters.type);
    if (filters.category) q = q.eq('category', filters.category);
    if (filters.memberId) q = q.eq('member_id', filters.memberId);
    if (entity === 'transactions') q = q.order('date', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }
  async upsert(entity, householdId, record) {
    const session = await this.getSession();
    const payload = { ...record, household_id: householdId };
    if (record.id) {
      const { data, error } = await this.sb.from(entity).update(payload).eq('id', record.id).select().single();
      if (error) throw error;
      return data;
    } else {
      payload.created_by = session.user.id;
      const { data, error } = await this.sb.from(entity).insert(payload).select().single();
      if (error) throw error;
      return data;
    }
  }
  async remove(entity, householdId, id) {
    // Soft delete
    const { error } = await this.sb.from(entity).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  // ── rates ───────────────────────────────────────────────────
  async getRates(householdId) {
    const { data, error } = await this.sb.from('exchange_rates').select('*').eq('household_id', householdId);
    if (error) throw error;
    return Object.fromEntries(data.map(r => [r.currency_code, parseFloat(r.rate_to_usd)]));
  }
  async upsertRate(householdId, code, rate) {
    const { error } = await this.sb.from('exchange_rates').upsert({
      household_id: householdId, currency_code: code, rate_to_usd: rate
    });
    if (error) throw error;
  }

  // ── realtime ────────────────────────────────────────────────
  subscribe(householdId, onChange) {
    if (this._channels.has(householdId)) return;
    const channel = this.sb.channel(`hh:${householdId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', filter: `household_id=eq.${householdId}` },
        payload => onChange(payload))
      .subscribe();
    this._channels.set(householdId, channel);
  }
  unsubscribe(householdId) {
    const ch = this._channels.get(householdId);
    if (ch) { this.sb.removeChannel(ch); this._channels.delete(householdId); }
  }
}

// ════════════════════════════════════════════════════════════════
// IMPL 3 · HybridAdapter
// Production model: read from cache for instant paint, write to
// cache + queue, flush queue to Supabase, reconcile on reconnect.
// Stub here — implement after Supabase wiring is verified.
// ════════════════════════════════════════════════════════════════
class HybridAdapter extends DataAdapter {
  constructor(supabaseClient) {
    super();
    this.cache  = new LocalStorageAdapter();
    this.cloud  = new SupabaseAdapter(supabaseClient);
    this.online = navigator.onLine;
    window.addEventListener('online',  () => { this.online = true;  this._flushQueue(); });
    window.addEventListener('offline', () => { this.online = false; });
  }
  // Reads: cache first, then refresh from cloud
  async list(entity, householdId, filters) {
    const cached = await this.cache.list(entity, householdId, filters);
    queueMicrotask(async () => {
      if (this.online) {
        try {
          const fresh = await this.cloud.list(entity, householdId, filters);
          // Replace cache with fresh data
          localStorage.setItem(`ff_${householdId}_${entity}`, JSON.stringify(fresh));
          this.emit(`${entity}:changed`, { householdId });
        } catch {}
      }
    });
    return cached;
  }
  // Writes: cache immediately + enqueue + try flush
  async upsert(entity, householdId, record) {
    const local = await this.cache.upsert(entity, householdId, record);
    this._enqueue({ op: 'upsert', entity, householdId, record: local });
    if (this.online) this._flushQueue();
    return local;
  }
  async remove(entity, householdId, id) {
    await this.cache.remove(entity, householdId, id);
    this._enqueue({ op: 'remove', entity, householdId, id });
    if (this.online) this._flushQueue();
  }
  _enqueue(op) {
    const queue = JSON.parse(localStorage.getItem('ff_queue') || '[]');
    queue.push({ ...op, ts: Date.now() });
    localStorage.setItem('ff_queue', JSON.stringify(queue));
  }
  async _flushQueue() {
    const queue = JSON.parse(localStorage.getItem('ff_queue') || '[]');
    const remaining = [];
    for (const op of queue) {
      try {
        if (op.op === 'upsert') await this.cloud.upsert(op.entity, op.householdId, op.record);
        else if (op.op === 'remove') await this.cloud.remove(op.entity, op.householdId, op.id);
      } catch {
        remaining.push(op);
      }
    }
    localStorage.setItem('ff_queue', JSON.stringify(remaining));
  }
  // Delegate everything else to cloud (auth, households, memberships, invites)
  async getSession()       { return this.cloud.getSession(); }
  async signUp(...a)       { return this.cloud.signUp(...a); }
  async signIn(...a)       { return this.cloud.signIn(...a); }
  async signOut()          { return this.cloud.signOut(); }
  async getProfile()       { return this.cloud.getProfile(); }
  async updateProfile(p)   { return this.cloud.updateProfile(p); }
  async listHouseholds()   { return this.cloud.listHouseholds(); }
  async createHousehold(n,t){return this.cloud.createHousehold(n,t); }
  async listMemberships(h) { return this.cloud.listMemberships(h); }
  async createInvitation(...a){return this.cloud.createInvitation(...a); }
  async acceptInvitation(t){ return this.cloud.acceptInvitation(t); }
  async removeMember(id)   { return this.cloud.removeMember(id); }
  subscribe(h, fn)         { return this.cloud.subscribe(h, fn); }
  unsubscribe(h)           { return this.cloud.unsubscribe(h); }
}

// ════════════════════════════════════════════════════════════════
// FACTORY · pick the right adapter
// ════════════════════════════════════════════════════════════════
function createAdapter({ supabaseUrl, supabaseKey } = {}) {
  if (supabaseUrl && supabaseKey && typeof supabase !== 'undefined') {
    const sb = supabase.createClient(supabaseUrl, supabaseKey);
    return new HybridAdapter(sb);
  }
  return new LocalStorageAdapter();
}

// Export for use in app.js
window.FinFlowAdapters = { DataAdapter, LocalStorageAdapter, SupabaseAdapter, HybridAdapter, createAdapter };
