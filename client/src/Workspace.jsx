import { useEffect, useMemo, useState } from 'react';
import { workspaceApi } from './api/workspace.js';

const roles = {
  investor: { label: 'Investor', welcome: 'Find companies worth believing in.', explore: 'Explore startups' },
  founder: { label: 'Founder', welcome: 'Build the right connections for your next chapter.', explore: 'Discover investors' },
  admin: { label: 'Administrator', welcome: 'Keep the StartupScout community moving forward.', explore: 'Platform overview' },
};

function payloadValue(value) {
  return value?.data ?? value;
}
function profileValue(value) {
  const data = payloadValue(value);
  return data?.profile ?? data?.investor ?? data?.founder ?? data;
}
function startupValue(profile) {
  return profile?.startup ?? profile?.primaryStartup ?? null;
}
function display(value, fallback = 'Not added yet') {
  return value === undefined || value === null || value === '' ? fallback : value;
}
function listValue(value) {
  return Array.isArray(value) ? value : [];
}
function Field({ label, name, value, onChange, type = 'text', hint, ...props }) {
  return <label className="workspace-field"><span>{label}</span><input name={name} type={type} value={value ?? ''} onChange={onChange} {...props} />{hint && <small>{hint}</small>}</label>;
}
function Select({ label, name, value, onChange, options }) {
  return <label className="workspace-field"><span>{label}</span><select name={name} value={value ?? ''} onChange={onChange}>{options.map((option) => <option key={option} value={option}>{option || 'Choose one'}</option>)}</select></label>;
}
function Pill({ children }) { return <span className="workspace-pill">{children}</span>; }

function ProfileView({ profile, role, user }) {
  const startup = startupValue(profile);
  const isFounder = role === 'founder';
  const values = isFounder ? [
    ['Company', startup?.name], ['Industry', startup?.industry], ['Funding stage', startup?.fundingStage], ['Location', startup?.location],
    ['Website', startup?.website], ['Founded', startup?.foundedYear], ['Team size', startup?.teamSize], ['Business model', startup?.businessModel],
  ] : [
    ['Investor type', profile?.investorType], ['Organization', profile?.organizationName], ['Investment thesis', profile?.investmentThesis],
    ['Website', profile?.website], ['LinkedIn', profile?.linkedInUrl], ['Investment range', profile?.investmentRange ? `${profile.investmentRange.currency || ''} ${profile.investmentRange.min ?? '—'} – ${profile.investmentRange.max ?? '—'}` : ''],
  ];
  return <section className="workspace-panel profile-panel">
    <div className="profile-hero">
      {profile?.profilePhotoUrl ? <img className="profile-photo" src={profile.profilePhotoUrl} alt="Profile" /> : <div className="profile-photo initials">{(user.fullName || user.name || 'S').slice(0, 1).toUpperCase()}</div>}
      <div><span className="workspace-eyebrow">{isFounder ? 'FOUNDER PROFILE' : 'INVESTOR PROFILE'}</span><h2>{display(profile?.fullName || user.fullName || user.name, 'Your profile')}</h2><p>{display(profile?.city ? [profile.city, profile.country].filter(Boolean).join(', ') : profile?.location, 'Add your location')}</p></div>
      {isFounder && startup?.moderationStatus && <Pill>{startup.moderationStatus}</Pill>}
    </div>
    <div className="profile-description"><span className="workspace-eyebrow">{isFounder ? 'ABOUT THE COMPANY' : 'ABOUT THE INVESTOR'}</span><p>{display(isFounder ? startup?.description : profile?.biography)}</p></div>
    <div className="profile-data-grid">{values.map(([label, value]) => <div className="profile-data" key={label}><span>{label}</span><strong>{display(value)}</strong></div>)}</div>
    {!isFounder && <div className="profile-description"><span className="workspace-eyebrow">AREAS OF INTEREST</span><div className="workspace-pills">{listValue(profile?.industriesOfInterest).length ? listValue(profile.industriesOfInterest).map((item) => <Pill key={item}>{item}</Pill>) : <span className="quiet-text">No industries added yet.</span>}</div></div>}
    {isFounder && startup && <div className="profile-description private-financial"><div><span className="workspace-eyebrow">YOUR FINANCIAL DETAILS</span><p>{startup.annualTurnover ? `${startup.turnoverCurrency || ''} ${startup.annualTurnover} revenue in ${startup.financialYear || 'the selected financial year'}` : 'Annual turnover has not been added.'}</p></div><span className="private-badge">◉ PRIVATE BY DEFAULT</span></div>}
  </section>;
}

function EditProfile({ role, profile, onSaved, onCancel }) {
  const startup = startupValue(profile) || {};
  const founder = role === 'founder';
  const [form, setForm] = useState({
    fullName: profile?.fullName || '', phone: profile?.phone || '', city: profile?.city || '', country: profile?.country || '',
    biography: profile?.biography || '', website: profile?.website || '', linkedInUrl: profile?.linkedInUrl || '',
    investorType: profile?.investorType || 'individual', organizationName: profile?.organizationName || '',
    investmentThesis: profile?.investmentThesis || '', industriesOfInterest: listValue(profile?.industriesOfInterest).join(', '),
    preferredFundingStages: listValue(profile?.preferredFundingStages).join(', '), preferredStartupLocations: listValue(profile?.preferredStartupLocations).join(', '),
    minInvestment: profile?.investmentRange?.min ?? '', maxInvestment: profile?.investmentRange?.max ?? '', currency: profile?.investmentRange?.currency || 'USD',
    name: startup.name || '', industry: startup.industry || '', description: startup.description || '', location: startup.location || '',
    fundingStage: startup.fundingStage || '', fundingGoal: startup.fundingGoal ?? '', foundedYear: startup.foundedYear ?? '', teamSize: startup.teamSize ?? '',
    businessModel: startup.businessModel || '', targetMarket: startup.targetMarket || '', productName: startup.productName || '',
    productDescription: startup.productDescription || '', annualTurnover: startup.annualTurnover ?? '', turnoverCurrency: startup.turnoverCurrency || 'USD',
    financialYear: startup.financialYear || '', fundingRaised: startup.fundingRaised ?? '', profilePhotoUrl: profile?.profilePhotoUrl || '',
    logoUrl: startup.logoUrl || '', coverImageUrl: startup.coverImageUrl || '', productGallery: listValue(startup.productGallery),
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function upload(event, purpose, field) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setError(''); setMessage('');
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError('Choose JPG, PNG, or WebP images.'); event.target.value = ''; return; }
    if (files.some((file) => file.size > 5 * 1024 * 1024)) { setError('Images must be 5 MB or smaller.'); event.target.value = ''; return; }
    setUploading(field);
    try {
      const urls = [];
      for (const file of files) {
        const result = await workspaceApi.uploadImage(purpose, file);
        const data = payloadValue(result);
        const url = data?.url || data?.imageUrl || data?.asset?.url || data?.upload?.url;
        if (!url) throw new Error('The upload completed without returning an image URL.');
        urls.push(url);
      }
      setForm((current) => ({ ...current, [field]: field === 'productGallery' ? [...current.productGallery, ...urls] : urls[0] }));
      setMessage(`${urls.length > 1 ? `${urls.length} images` : 'Image'} uploaded. Save your profile to keep the change.`);
    } catch (uploadError) { setError(uploadError.message); }
    finally { setUploading(''); event.target.value = ''; }
  }

  async function submit(event) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    const personal = {
      fullName: form.fullName, phone: form.phone, city: form.city, country: form.country,
      ...(founder ? {} : {
        biography: form.biography, investorType: form.investorType, organizationName: form.organizationName,
        investmentThesis: form.investmentThesis, industriesOfInterest: form.industriesOfInterest.split(',').map((x) => x.trim()).filter(Boolean),
        preferredFundingStages: form.preferredFundingStages.split(',').map((x) => x.trim()).filter(Boolean),
        preferredStartupLocations: form.preferredStartupLocations.split(',').map((x) => x.trim()).filter(Boolean),
        investmentRange: { min: Number(form.minInvestment), max: Number(form.maxInvestment), currency: form.currency },
        website: form.website, linkedInUrl: form.linkedInUrl,
      }), profilePhotoUrl: form.profilePhotoUrl,
    };
    const company = {
      name: form.name, industry: form.industry, description: form.description, location: form.location,
      fundingStage: form.fundingStage, fundingGoal: Number(form.fundingGoal), foundedYear: Number(form.foundedYear),
      teamSize: Number(form.teamSize), businessModel: form.businessModel, targetMarket: form.targetMarket,
      productName: form.productName, productDescription: form.productDescription, website: form.website,
      annualTurnover: form.annualTurnover === '' ? undefined : Number(form.annualTurnover), turnoverCurrency: form.turnoverCurrency,
      financialYear: form.financialYear, fundingRaised: form.fundingRaised === '' ? undefined : Number(form.fundingRaised),
      logoUrl: form.logoUrl, coverImageUrl: form.coverImageUrl, productGallery: form.productGallery,
    };
    try {
      const updated = await workspaceApi.updateProfile(personal);
      if (founder) await workspaceApi.updateStartup(company);
      onSaved(profileValue(updated));
    } catch (saveError) { setError(saveError.message); }
    finally { setBusy(false); }
  }

  const imageUpload = (label, purpose, field, multiple = false) => <div className="upload-row"><div><strong>{label}</strong><span>{multiple ? `${form[field]?.length || 0} images · JPG, PNG, or WebP · up to 5 MB each` : form[field] ? 'Image uploaded' : 'JPG, PNG, or WebP · up to 5 MB'}</span></div><label className="upload-button">{uploading === field ? 'Uploading…' : multiple ? 'Add images' : form[field] ? 'Replace image' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} disabled={Boolean(uploading)} onChange={(event) => upload(event, purpose, field)} /></label></div>;

  return <form className="workspace-panel edit-panel" onSubmit={submit}>
    <div className="panel-heading"><div><span className="workspace-eyebrow">PROFILE SETTINGS</span><h2>Edit your {founder ? 'founder' : 'investor'} profile</h2><p>Your information is saved to your StartupScout account.</p></div><button className="plain-button" type="button" onClick={onCancel}>Cancel</button></div>
    <h3>Personal information</h3>
    <div className="edit-grid"><Field label="Full name" name="fullName" value={form.fullName} onChange={change} required /><Field label="Phone" name="phone" value={form.phone} onChange={change} /><Field label="City" name="city" value={form.city} onChange={change} /><Field label="Country" name="country" value={form.country} onChange={change} /></div>
    {!founder && <><h3>Investment profile</h3><div className="edit-grid"><Select label="Investor type" name="investorType" value={form.investorType} onChange={change} options={['individual','angel','venture-capital']} /><Field label="Organization" name="organizationName" value={form.organizationName} onChange={change} /><Field label="Website" name="website" type="url" value={form.website} onChange={change} /><Field label="LinkedIn URL" name="linkedInUrl" type="url" value={form.linkedInUrl} onChange={change} /></div><Field label="Biography" name="biography" value={form.biography} onChange={change} /><Field label="Investment thesis" name="investmentThesis" value={form.investmentThesis} onChange={change} /><div className="edit-grid"><Field label="Industries (comma separated)" name="industriesOfInterest" value={form.industriesOfInterest} onChange={change} /><Field label="Preferred stages (comma separated)" name="preferredFundingStages" value={form.preferredFundingStages} onChange={change} /><Field label="Preferred startup locations" name="preferredStartupLocations" value={form.preferredStartupLocations} onChange={change} /><Field label="Website" name="website" value={form.website} onChange={change} /></div><div className="edit-grid edit-three"><Field label="Minimum investment" name="minInvestment" type="number" min="0" value={form.minInvestment} onChange={change} /><Field label="Maximum investment" name="maxInvestment" type="number" min="0" value={form.maxInvestment} onChange={change} /><Select label="Currency" name="currency" value={form.currency} onChange={change} options={['USD','EUR','GBP','INR','CAD','AUD']} /></div></>}
    {founder && <><h3>Startup information</h3><div className="edit-grid"><Field label="Startup name" name="name" value={form.name} onChange={change} required /><Field label="Industry" name="industry" value={form.industry} onChange={change} required /><Field label="Location" name="location" value={form.location} onChange={change} /><Select label="Funding stage" name="fundingStage" value={form.fundingStage} onChange={change} options={['Pre-seed','Seed','Series A','Series B','Growth']} /><Field label="Website" name="website" type="url" value={form.website} onChange={change} /><Field label="Founded year" name="foundedYear" type="number" value={form.foundedYear} onChange={change} /><Field label="Team size" name="teamSize" type="number" value={form.teamSize} onChange={change} /><Field label="Funding target" name="fundingGoal" type="number" value={form.fundingGoal} onChange={change} /><Field label="Amount raised" name="fundingRaised" type="number" value={form.fundingRaised} onChange={change} /><Field label="Business model" name="businessModel" value={form.businessModel} onChange={change} /><Field label="Target market" name="targetMarket" value={form.targetMarket} onChange={change} /><Field label="Product or service" name="productName" value={form.productName} onChange={change} /></div><Field label="Company description" name="description" value={form.description} onChange={change} /><Field label="Product description" name="productDescription" value={form.productDescription} onChange={change} /><div className="revenue-private"><div><strong>Annual turnover means revenue for a financial year.</strong><span>It is not profit, company valuation, or funds raised. This information stays private unless you choose otherwise.</span></div><div className="edit-grid edit-three"><Field label="Annual turnover" name="annualTurnover" type="number" min="0" value={form.annualTurnover} onChange={change} /><Select label="Currency" name="turnoverCurrency" value={form.turnoverCurrency} onChange={change} options={['USD','EUR','GBP','INR','CAD','AUD']} /><Field label="Financial year" name="financialYear" value={form.financialYear} onChange={change} placeholder="FY2025" /></div></div><h3>Company images</h3>{imageUpload('Company logo','startup-logo','logoUrl')}{imageUpload('Cover image','startup-cover','coverImageUrl')}{imageUpload('Product gallery','product-gallery','productGallery',true)}{form.productGallery.length > 0 && <div className="gallery-preview">{form.productGallery.map((url,index)=><div key={`${url}-${index}`}><img src={url} alt={`Product gallery ${index + 1}`} /><button type="button" onClick={()=>setForm((current)=>({...current,productGallery:current.productGallery.filter((_,itemIndex)=>itemIndex!==index)}))} aria-label={`Remove product image ${index+1}`}>×</button></div>)}</div>}</>}
    <h3>Profile photo</h3>{imageUpload('Profile photo','profile-photo','profilePhotoUrl')}
    {error && <div className="workspace-alert error" role="alert">{error}</div>}{message && <div className="workspace-alert success" role="status">{message}</div>}
    <div className="edit-actions"><button className="workspace-primary" disabled={busy || Boolean(uploading)}>{busy ? 'Saving…' : 'Save changes'}</button></div>
  </form>;
}

function Discover({ role }) {
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('');
  const [stage, setStage] = useState('');
  const [location, setLocation] = useState('');
  const [sort, setSort] = useState('newest');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const investor = role === 'investor';

  async function search(event) {
    event?.preventDefault(); setBusy(true); setError(''); setSearched(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set('search', query.trim());
    if (industry) params.set('industry', industry);
    if (stage) params.set(investor ? 'fundingStage' : 'preferredFundingStage', stage);
    if (location.trim()) params.set('location', location.trim());
    params.set('sort', sort);
    try {
      const response = investor ? await workspaceApi.discoverStartups(params) : await workspaceApi.discoverInvestors(params);
      const data = payloadValue(response);
      setResults(Array.isArray(data) ? data : data?.startups ?? data?.investors ?? data?.results ?? []);
    } catch (requestError) { setError(requestError.message); setResults([]); }
    finally { setBusy(false); }
  }
  useEffect(() => { search(); }, []);

  const people = useMemo(() => results.map((item) => ({
    key: item._id || item.id || item.email,
    title: item.name || item.organizationName || item.fullName || 'StartupScout member',
    subtitle: investor ? [item.industry, item.location].filter(Boolean).join(' · ') : [item.investorType, item.organizationName].filter(Boolean).join(' · '),
    description: investor ? item.description : item.investmentThesis || item.biography,
    tag: investor ? item.fundingStage : item.preferredFundingStages?.join?.(', '),
    avatar: investor ? item.logoUrl : item.profilePhotoUrl,
  })), [results, investor]);

  return <section className="discover-page">
    <div className="workspace-page-heading"><div><span className="workspace-eyebrow">{investor ? 'STARTUP DIRECTORY' : 'INVESTOR NETWORK'}</span><h2>{investor ? 'Explore startups' : 'Discover investors'}</h2><p>{investor ? 'Search public startup profiles and find teams that match your thesis.' : 'Explore investor profiles using the preferences they chose to share.'}</p></div><span className="directory-lock">◉ PUBLIC PROFILES</span></div>
    <form className="discover-filters" onSubmit={search}>
      <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={investor ? 'Search startups or ideas' : 'Search investors or firms'} /></label>
      <input className="filter-input" value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="Industry" aria-label="Industry" />
      <select className="filter-input" value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Funding stage"><option value="">All stages</option>{['Pre-seed','Seed','Series A','Series B','Growth'].map((item) => <option key={item}>{item}</option>)}</select>
      <input className="filter-input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" aria-label="Location" />
      <select className="filter-input" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort"><option value="newest">Newest</option><option value="name">Name</option></select>
      <button className="workspace-primary">Search</button>
      <button type="button" className="plain-button" onClick={() => { setQuery(''); setIndustry(''); setStage(''); setLocation(''); setSort('newest'); setTimeout(() => search(), 0); }}>Clear</button>
    </form>
    {error && <div className="workspace-alert error" role="alert">{error}</div>}
    {busy ? <div className="empty-state"><span className="spinner" />Searching the network…</div> : people.length ? <div className="directory-grid">{people.map((item) => <article className="directory-card" key={item.key}>
      <div className="directory-card-top">{item.avatar ? <img src={item.avatar} alt="" /> : <div className="directory-avatar">{item.title.slice(0, 1).toUpperCase()}</div>}<div><strong>{item.title}</strong><small>{item.subtitle || 'Profile details available'}</small></div></div>
      <p>{item.description || 'This member has not added a description yet.'}</p>
      <div className="directory-card-bottom"><Pill>{item.tag || (investor ? 'Startup' : 'Investor')}</Pill><span>Public profile</span></div>
    </article>)}</div> : <div className="empty-state"><span>⌕</span><strong>{searched ? 'No matching profiles yet' : 'Search the StartupScout network'}</strong><p>Try adjusting your filters or using a broader search.</p></div>}
  </section>;
}

function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [updating, setUpdating] = useState('');
  const [filter, setFilter] = useState('');
  async function load() {
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams(); if (filter) params.set('status', filter);
      const [summary, userResponse] = await Promise.all([workspaceApi.getAdminOverview(), workspaceApi.getAdminUsers(params)]);
      const overviewData = payloadValue(summary); const userData = payloadValue(userResponse);
      setOverview(overviewData?.overview ?? overviewData);
      setUsers(Array.isArray(userData) ? userData : userData?.users ?? []);
    } catch (loadError) { setError(loadError.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [filter]);
  async function changeStatus(user, status) {
    const id = user._id || user.id;
    setUpdating(id); setError('');
    try { await workspaceApi.updateAccountStatus(id, status); await load(); }
    catch (updateError) { setError(updateError.message); }
    finally { setUpdating(''); }
  }
  const metrics = overview ? Object.entries(overview).filter(([, value]) => typeof value === 'number') : [];
  return <section className="admin-dashboard">
    <div className="workspace-page-heading"><div><span className="workspace-eyebrow">ADMIN CONSOLE</span><h2>Platform overview</h2><p>Authorized account management and platform operations.</p></div><span className="admin-shield">⌘ AUTHORIZED</span></div>
    {error && <div className="workspace-alert error" role="alert">{error}</div>}
    {busy ? <div className="empty-state"><span className="spinner" />Loading platform data…</div> : <>
      {metrics.length > 0 && <div className="metrics-row">{metrics.map(([key, value]) => <div className="metric-card" key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><strong>{value}</strong></div>)}</div>}
      <div className="admin-table-heading"><div><h3>Accounts</h3><p>Account status and access controls</p></div><select className="filter-input" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
      <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Account</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map((user) => <tr key={user._id || user.id}><td><strong>{user.fullName || user.name || 'StartupScout member'}</strong><small>{user.email}</small></td><td>{user.role}</td><td><Pill>{user.status || 'active'}</Pill></td><td><button className="table-action" disabled={updating === (user._id || user.id)} onClick={() => changeStatus(user, user.status === 'suspended' ? 'active' : 'suspended')}>{updating === (user._id || user.id) ? 'Updating…' : user.status === 'suspended' ? 'Reinstate' : 'Suspend'}</button></td></tr>)}</tbody></table>{!users.length && <div className="empty-state">No accounts found for this filter.</div>}</div>
    </>}
  </section>;
}

export default function Workspace({ user, onSignOut }) {
  const role = user.role;
  const config = roles[role] || roles.investor;
  const [page, setPage] = useState('dashboard');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role === 'admin') { setLoading(false); return; }
    workspaceApi.getProfile().then((result) => setProfile(profileValue(result))).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, [role]);

  useEffect(() => {
    const onHash = () => {
      const pageFromHash = window.location.hash.replace(/^#\/?/, '').split('/')[0];
      if (pageFromHash === 'workspace') setPage('dashboard');
      else if (['dashboard','discover','profile','edit-profile','notifications','settings','admin'].includes(pageFromHash)) setPage(pageFromHash);
    };
    window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function navigate(next) { setPage(next); window.location.hash = `/${next}`; }
  async function saved(nextProfile) {
    try { const refreshed = await workspaceApi.getProfile(); setProfile(profileValue(refreshed)); }
    catch { if (nextProfile) setProfile(nextProfile); }
    navigate('profile');
  }
  const navigation = role === 'admin'
    ? [['dashboard', 'Platform overview', '▦']]
    : [['dashboard', 'Dashboard', '⌂'], ['discover', role === 'investor' ? 'Explore startups' : 'Discover investors', '⌕'], ['profile', 'My Profile', '◉'], ['edit-profile', 'Edit Profile', '✎'], ['notifications', 'Notifications', '◷'], ['settings', 'Settings', '⚙']];

  return <div className="app-shell">
    <aside className="app-sidebar"><div className="sidebar-brand"><a href="#/workspace"><span className="brand-mark"><i /><i /><i /></span><strong>startup<span>scout</span></strong></a></div><div className="workspace-label">YOUR WORKSPACE</div>
      <nav>{navigation.map(([key, label, icon]) => <button key={key} className={page === key ? 'nav-item active' : 'nav-item'} onClick={() => navigate(key)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-member"><div>{(user.fullName || user.name || 'S').slice(0,1).toUpperCase()}</div><span><strong>{user.fullName || user.name || 'Member'}</strong><small>{config.label}</small></span><span className="member-menu">•••</span></div><button className="nav-item signout-item" onClick={onSignOut}><span>↪</span>Sign out</button></div>
    </aside>
    <main className="app-main"><header className="app-topbar"><div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{navigation.find(([key]) => key === page)?.[1] || (page === 'admin' ? 'Admin' : 'Dashboard')}</strong></div><div className="topbar-right"><span className="role-chip">{config.label}</span><div className="topbar-avatar">{(user.fullName || user.name || 'S').slice(0,1).toUpperCase()}</div></div></header>
      <div className="workspace-content">{error && page !== 'profile' && page !== 'edit-profile' && <div className="workspace-alert error" role="alert">{error}</div>}
        {role === 'admin' && <AdminDashboard />}
        {role !== 'admin' && page === 'dashboard' && <section className="dashboard-view"><div className="dashboard-greeting"><div><span className="workspace-eyebrow">YOUR {config.label.toUpperCase()} WORKSPACE</span><h1>{user.fullName ? `Good to see you, ${user.fullName.split(' ')[0]}.` : 'Welcome to StartupScout.'}</h1><p>{config.welcome}</p></div><button className="workspace-primary" onClick={() => navigate('discover')}>{config.explore}<span>→</span></button></div><div className="dashboard-summary-grid"><article className="summary-card summary-feature"><span className="summary-icon">{role === 'investor' ? '↗' : '✳'}</span><div><span className="workspace-eyebrow">YOUR NEXT STEP</span><h3>{profile ? 'Your profile is ready to grow.' : 'Complete your profile.'}</h3><p>{role === 'investor' ? 'Share your thesis and preferences so founders can find a thoughtful partner.' : 'Help investors understand your company, product, and funding goals.'}</p><button className="inline-link" onClick={() => navigate(profile ? 'profile' : 'edit-profile')}>{profile ? 'View My Profile' : 'Set up your profile'} <span>→</span></button></div></article><article className="summary-card"><span className="summary-icon">⌕</span><span className="workspace-eyebrow">DISCOVER</span><h3>{role === 'investor' ? 'Find your next investment.' : 'Meet aligned investors.'}</h3><p>Use search and preferences to explore the StartupScout network.</p><button className="inline-link" onClick={() => navigate('discover')}>Open discovery <span>→</span></button></article><article className="summary-card quiet-summary"><span className="summary-icon">◉</span><span className="workspace-eyebrow">YOUR ACCOUNT</span><h3>Private by design.</h3><p>Account details and saved preferences are managed securely.</p><button className="inline-link" onClick={() => navigate('settings')}>Account settings <span>→</span></button></article></div><div className="dashboard-bottom"><div className="dashboard-bottom-copy"><span className="workspace-eyebrow">A BETTER WAY TO CONNECT</span><h2>Good companies find<br />good company.</h2><p>Search thoughtfully, meet intentionally, and build the right relationship for what comes next.</p></div><div className="dashboard-stamp"><span>STARTUPSCOUT</span><strong>✳</strong><small>THE PEOPLE BEHIND WHAT'S NEXT</small></div></div></section>}
        {role !== 'admin' && page === 'discover' && <Discover role={role} />}
        {role !== 'admin' && page === 'profile' && <section className="workspace-page"><div className="workspace-page-heading"><div><span className="workspace-eyebrow">YOUR ACCOUNT</span><h2>My Profile</h2><p>This is the profile saved to your StartupScout account.</p></div><button className="workspace-primary" onClick={() => navigate('edit-profile')}>Edit profile <span>✎</span></button></div>{loading ? <div className="empty-state"><span className="spinner" />Loading your saved profile…</div> : profile ? <ProfileView profile={profile} role={role} user={user} /> : <div className="empty-state"><strong>Your profile is ready for its first details.</strong><p>Add a few details to help the right people find you.</p><button className="workspace-primary" onClick={() => navigate('edit-profile')}>Create profile <span>→</span></button></div>}</section>}
        {role !== 'admin' && page === 'edit-profile' && <section className="workspace-page">{loading ? <div className="empty-state"><span className="spinner" />Loading your saved profile…</div> : <EditProfile role={role} profile={profile || {}} onSaved={saved} onCancel={() => navigate('profile')} />}</section>}
        {role !== 'admin' && page === 'notifications' && <section className="workspace-page"><div className="workspace-page-heading"><div><span className="workspace-eyebrow">YOUR ACTIVITY</span><h2>Notifications</h2><p>Updates relevant to your account will appear here.</p></div></div><div className="empty-state"><span>◷</span><strong>Your notifications will show here</strong><p>You’ll see connection requests and other account activity as they arrive.</p></div></section>}
        {role !== 'admin' && page === 'settings' && <section className="workspace-page"><div className="workspace-page-heading"><div><span className="workspace-eyebrow">ACCOUNT</span><h2>Settings</h2><p>Manage your account access and profile preferences.</p></div></div><div className="settings-card"><div><strong>Signed in as</strong><span>{user.email}</span></div><div><strong>Account type</strong><span>{config.label}</span></div><div><strong>Session security</strong><span>Protected by a secure HttpOnly session cookie</span></div><button className="plain-button" onClick={onSignOut}>Sign out of StartupScout</button></div></section>}
      </div>
    </main>
  </div>;
}
