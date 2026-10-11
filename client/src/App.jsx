import { useEffect, useMemo, useState } from 'react';
import { authApi } from './api/auth.js';
import Workspace from './Workspace.jsx';
import { buildInvestorRegistrationPayload, clearFieldErrors, mapRegistrationFieldErrors, passwordToggleProps, validateAccountStep, validateInvestorProfile } from './registrationValidation.js';

const stages = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth'];
const industries = ['AI & Machine Learning', 'Climate & Energy', 'Consumer', 'Fintech', 'Healthcare', 'SaaS', 'Other'];
// Version the non-sensitive restore hint so stale values from previous client builds do not
// trigger an /auth/me request with a session the current browser no longer has.
const SESSION_HINT = 'startupscout.session-established.v2';
let sessionRequest;

function restoreSession() {
  if (!sessionRequest) {
    sessionRequest = authApi.me().finally(() => { sessionRequest = null; });
  }
  return sessionRequest;
}

function readRoute() {
  const [page, role] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { page: page || 'login', role: ['investor', 'founder', 'admin'].includes(role) ? role : 'investor' };
}

function go(page, role) {
  window.location.hash = `/${page}/${role}`;
}

const blankInvestor = {
  fullName: '', email: '', password: '', confirmPassword: '', phone: '', city: '', country: '',
  investorType: 'individual', organizationName: '', biography: '', investmentThesis: '',
  industriesOfInterest: [], preferredFundingStages: [], minInvestment: '', maxInvestment: '',
  currency: 'USD', preferredStartupLocations: '', website: '', linkedInUrl: '',
};

const blankFounder = {
  fullName: '', email: '', password: '', confirmPassword: '', phone: '', city: '', country: '',
  founderDesignation: 'Founder & CEO', name: '', industry: '', description: '', location: '',
  fundingStage: 'Pre-seed', fundingGoal: '', foundedYear: '', website: '', teamSize: '',
  businessModel: '', targetMarket: '', annualTurnover: '', turnoverCurrency: 'USD',
  financialYear: '', fundingRaised: '', productName: '', productDescription: '',
};

function Brand({ compact = false }) {
  return <a className={`brand ${compact ? 'brand-compact' : ''}`} href="#/login/investor" aria-label="StartupScout home">
    <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
    <span>startup<span className="brand-accent">scout</span></span>
  </a>;
}

function RoleTabs({ role, onChange, includeAdmin = false }) {
  const roles = includeAdmin ? ['investor', 'founder', 'admin'] : ['investor', 'founder'];
  return <div className="role-tabs" role="tablist" aria-label="Choose account type">
    {roles.map((item) => <button key={item} type="button" role="tab" aria-selected={role === item}
      className={role === item ? 'role-tab selected' : 'role-tab'} onClick={() => onChange(item)}>
      {item === 'investor' ? 'Investor' : item === 'founder' ? 'Startup founder' : 'Admin'}
    </button>)}
  </div>;
}

function Field({ label, name, value, onChange, type = 'text', required = false, hint, error, ...props }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === 'password';
  const toggle = passwordToggleProps(passwordVisible);
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return <label className="field">
    <span>{label}{required && <b className="required"> *</b>}</span>
    {isPassword ? <span className="password-control">
      <input name={name} type={toggle.inputType} value={value ?? ''} onChange={onChange} required={required}
        aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} {...props} />
      <button className="password-toggle" type={toggle.buttonType} aria-label={toggle.label}
        onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? 'Hide' : 'Show'}</button>
    </span> : <input name={name} type={type} value={value ?? ''} onChange={onChange} required={required}
      aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} {...props} />}
    {hint && <small id={hintId}>{hint}</small>}
    {error && <small className="field-error" id={errorId}>{error}</small>}
  </label>;
}

function SelectField({ label, name, value, onChange, options, required = false }) {
  return <label className="field"><span>{label}{required && <b className="required"> *</b>}</span>
    <select name={name} value={value} onChange={onChange} required={required}>
      {options.map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}
    </select>
  </label>;
}

function MultiChoice({ label, choices, value, onChange, error, name }) {
  const toggle = (choice) => onChange(value.includes(choice) ? value.filter((item) => item !== choice) : [...value, choice]);
  const errorId = error ? `${name}-error` : undefined;
  return <fieldset className="choice-field" aria-describedby={errorId} aria-invalid={error ? 'true' : undefined}><legend>{label}</legend>
    <div className="choice-grid">{choices.map((choice) => <label className="choice" key={choice}>
      <input type="checkbox" checked={value.includes(choice)} onChange={() => toggle(choice)} />
      <span>{choice}</span>
    </label>)}</div>
    {error && <small className="field-error" id={errorId}>{error}</small>}
  </fieldset>;
}

function AuthLayout({ children, mode, role, onRoleChange }) {
  return <div className="auth-page">
    <aside className="story-panel">
      <div className="story-top"><Brand /><span className="story-label">A clearer path to what's next</span></div>
      <div className="story-copy">
        <div className="eyebrow"><span className="eyebrow-dot" /> THE PEOPLE BEHIND WHAT'S NEXT</div>
        <h1>Big ideas move<br />when the right<br /><em>people meet.</em></h1>
        <p>Find the signal in startup discovery. Meet founders and investors building what matters.</p>
        <div className="signal-card">
          <div className="signal-top"><span>THE STARTUP SIGNAL</span><span className="signal-live">● LIVE</span></div>
          <div className="signal-data"><span className="signal-spark">↗</span><div><strong>1,240+</strong><small>ambitious teams</small></div><div className="signal-divider" /><div><strong>38</strong><small>industries explored</small></div></div>
          <div className="signal-bottom"><span>Good things are already in motion.</span><span>✦</span></div>
        </div>
      </div>
      <div className="story-footer"><span>Built for the people who build what's next.</span><span>© STARTUPSCOUT 2026</span></div>
      <div className="orbit orbit-one" /><div className="orbit orbit-two" />
    </aside>
    <main className="auth-main">
      <header className="mobile-brand"><Brand /></header>
      <div className="auth-inner">
        <div className="auth-switch">
          <div className="auth-switch-copy"><span>{mode === 'register' ? 'START YOUR JOURNEY' : 'WELCOME BACK'}</span><strong>{mode === 'register' ? 'Create your account' : 'Sign in to your account'}</strong></div>
          <RoleTabs role={role} onChange={onRoleChange} includeAdmin={mode === 'login'} />
        </div>
        {children}
        <footer className="form-footer"><span>By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</span><span>SECURE ACCESS <b>●</b></span></footer>
      </div>
    </main>
  </div>;
}

function Login({ role, onRoleChange, onAuthenticated, onRegister }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const change = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => { const next = { ...current }; delete next[name]; return next; });
    setError('');
  };

  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await authApi.login({ ...form, role });
      const user = result.user ?? result.data?.user;
      if (!user?.role || user.role !== role) throw new Error('This account does not match the selected sign-in type.');
      onAuthenticated(user);
    } catch (err) {
      const fields = err?.fields && typeof err.fields === 'object' ? err.fields : {};
      setFieldErrors(mapRegistrationFieldErrors(fields));
      setError(typeof err?.message === 'string' ? err.message : 'Sign in failed. Check your details and try again.');
    }
    finally { setBusy(false); }
  }

  const title = role === 'investor' ? 'Welcome back, investor.' : role === 'founder' ? 'Your next chapter starts here.' : 'Platform administration.';
  return <AuthLayout mode="login" role={role} onRoleChange={onRoleChange}>
    <section className="form-heading"><div className="avatar-icon">{role === 'investor' ? '↗' : role === 'founder' ? '✳' : '⌘'}</div><h2>{title}</h2><p>{role === 'admin' ? 'Authorized StartupScout employees only.' : 'Pick up where your ambition left off.'}</p></section>
    <form className="auth-form" onSubmit={submit}>
      <Field label="Email address" name="email" type="email" value={form.email} onChange={change} placeholder="you@example.com" required autoComplete="email" error={fieldErrors.email} />
      <Field label="Password" name="password" type="password" value={form.password} onChange={change} placeholder="Enter your password" required autoComplete="current-password" error={fieldErrors.password} />
      <div className="form-options"><label className="remember"><input type="checkbox" /> Remember me</label><a href="#forgot-password">Forgot password?</a></div>
      {error && <div className="alert error" role="alert">{error}</div>}
      <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <span>→</span></button>
    </form>
    {role !== 'admin' ? <div className="form-bottom">New to StartupScout? <button type="button" className="text-button" onClick={onRegister}>Create a {role === 'investor' ? 'investor' : 'founder'} account <span>→</span></button></div> : <p className="admin-note">Admin access is provisioned by StartupScout. Public admin registration is unavailable.</p>}
    <div className="trust-note"><span>▣</span><p><strong>Your information stays yours.</strong><br />We use secure, encrypted sessions to protect your account.</p></div>
  </AuthLayout>;
}

function Registration({ role, onRoleChange, onLogin, onRegistered }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(role === 'investor' ? { ...blankInvestor } : { ...blankFounder });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const founder = role === 'founder';
  const total = founder ? 3 : 2;

  useEffect(() => { setForm(founder ? { ...blankFounder } : { ...blankInvestor }); setStep(0); setError(''); setFieldErrors({}); }, [role, founder]);
  const clearFieldError = (name) => setFieldErrors((current) => clearFieldErrors(current, name));
  const change = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      const next = clearFieldErrors(current, name);
      if ((name === 'password' || name === 'confirmPassword') && value === (name === 'password' ? form.confirmPassword : form.password)) {
        delete next.confirmPassword;
      }
      return next;
    });
    setError('');
  };
  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    clearFieldError(name);
    setError('');
  };

  function focusFirstError(errors) {
    const first = Object.keys(errors)[0];
    if (first) document.querySelector(`[name="${first}"]`)?.focus();
  }

  function handleInvalid(event) {
    event.preventDefault();
    const { name, validity } = event.target;
    const messages = {
      fullName: 'Enter your full name.', email: 'Enter a valid email address.',
      investmentThesis: 'Investment thesis must be between 20 and 2,000 characters.',
      minInvestment: 'Enter a minimum investment amount.', maxInvestment: 'Enter a maximum investment amount.',
      password: 'Enter a password between 12 and 72 UTF-8 bytes.', confirmPassword: 'Confirm your password.',
    };
    const message = validity?.typeMismatch ? 'Enter a valid value.' : messages[name] || 'Complete this field before continuing.';
    setFieldErrors((current) => ({ ...current, [name]: message }));
  }

  function continueStep(event) {
    event.preventDefault(); setError('');
    const accountErrors = validateAccountStep(form);
    if (Object.keys(accountErrors).length) {
      setFieldErrors((current) => ({ ...current, ...accountErrors }));
      focusFirstError(accountErrors);
      return;
    }
    if (founder && step === 1 && Number(form.foundedYear) > new Date().getFullYear()) {
      const yearError = { foundedYear: 'Founding year cannot be in the future.' };
      setFieldErrors((current) => ({ ...current, ...yearError }));
      focusFirstError(yearError);
      return;
    }
    setStep((current) => Math.min(current + 1, total - 1));
  }

  async function submit(event) {
    event.preventDefault(); setError('');
    const accountErrors = validateAccountStep(form);
    const profileCheck = !founder ? validateInvestorProfile(form) : null;
    const validationErrors = { ...accountErrors, ...(profileCheck?.errors || {}) };
    if (Object.keys(validationErrors).length) {
      setFieldErrors((current) => ({ ...current, ...validationErrors }));
      focusFirstError(validationErrors);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    let payload = { ...form };
    if (founder) {
      payload.startup = {
        name: form.name, industry: form.industry, description: form.description, location: form.location || [form.city, form.country].filter(Boolean).join(', '),
        fundingStage: form.fundingStage, fundingGoal: Number(form.fundingGoal), foundedYear: Number(form.foundedYear), website: form.website || undefined,
        teamSize: Number(form.teamSize), businessModel: form.businessModel, targetMarket: form.targetMarket,
        annualTurnover: form.annualTurnover === '' ? undefined : Number(form.annualTurnover), turnoverCurrency: form.turnoverCurrency,
        financialYear: form.financialYear || undefined, fundingRaised: form.fundingRaised === '' ? undefined : Number(form.fundingRaised),
        productName: form.productName, productDescription: form.productDescription,
      };
      ['name','industry','description','location','fundingStage','fundingGoal','foundedYear','website','teamSize','businessModel','targetMarket','annualTurnover','turnoverCurrency','financialYear','fundingRaised','productName','productDescription'].forEach((key) => delete payload[key]);
    } else {
      payload = buildInvestorRegistrationPayload(form, profileCheck);
    }

    try {
      const response = founder ? await authApi.registerFounder(payload) : await authApi.registerInvestor(payload);
      onRegistered(response.user ?? response.data?.user);
    } catch (err) {
      const fields = err?.fields && typeof err.fields === 'object' ? mapRegistrationFieldErrors(err.fields) : {};
      setFieldErrors((current) => ({ ...current, ...fields }));
      setError(typeof err?.message === 'string' ? err.message : 'Registration failed. Check the highlighted fields and try again.');
      focusFirstError(fields);
    }
    finally { setBusy(false); }
  }

  const sectionTitle = founder ? ['Your account', 'Your startup', 'The details'][step] : ['Your account', 'Your investment profile'][step];
  return <AuthLayout mode="register" role={role} onRoleChange={onRoleChange}>
    <section className="form-heading registration-heading"><div className="eyebrow dark-eyebrow">{founder ? 'FOUNDER ONBOARDING' : 'INVESTOR ONBOARDING'}</div><h2>{founder ? 'Build your presence.' : 'Make your next move.'}</h2><p>{founder ? 'A few details help investors understand your vision.' : 'Tell founders what you are looking for.'}</p></section>
    <div className="stepper" aria-label={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }, (_, index) => <div key={index} className={`step-item ${index <= step ? 'active' : ''}`}><span>{index < step ? '✓' : `0${index + 1}`}</span><small>{founder ? ['Account', 'Company', 'Product'][index] : ['Account', 'Investor profile'][index]}</small></div>)}
    </div>
    <form className="auth-form registration-form" onSubmit={step < total - 1 ? continueStep : submit} onInvalid={handleInvalid}>
      <div className="step-title"><strong>{sectionTitle}</strong><span>STEP 0{step + 1} / 0{total}</span></div>
      {step === 0 && <>
        <div className="two-column"><Field label={founder ? 'Founder full name' : 'Full name'} name="fullName" value={form.fullName} onChange={change} placeholder="Your name" required autoComplete="name" /><Field label="Email address" name="email" type="email" value={form.email} onChange={change} placeholder="you@example.com" required autoComplete="email" /></div>
        <div className="two-column"><Field label="Password" name="password" type="password" value={form.password} onChange={change} placeholder="12–72 UTF-8 bytes" required autoComplete="new-password" hint="Use 12 to 72 UTF-8 bytes." error={fieldErrors.password} /><Field label="Confirm password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={change} placeholder="Type it again" required autoComplete="new-password" error={fieldErrors.confirmPassword} /></div>
        <div className="two-column"><Field label="Phone number" name="phone" type="tel" value={form.phone} onChange={change} placeholder="Optional" autoComplete="tel" /><Field label="City and country" name="city" value={form.city} onChange={change} placeholder="City" autoComplete="address-level2" /></div>
        <Field label="Country" name="country" value={form.country} onChange={change} placeholder="Country" autoComplete="country-name" />
      </>}
      {!founder && step === 1 && <>
        <div className="two-column"><SelectField label="Investor type" name="investorType" value={form.investorType} onChange={change} options={[{ value: 'individual', label: 'Individual investor' }, { value: 'angel', label: 'Angel investor' }, { value: 'venture-capital', label: 'Venture capital firm' }]} required /><Field label="Organization / firm" name="organizationName" value={form.organizationName} onChange={change} placeholder="Optional" /></div>
        <Field label="Investment thesis" name="investmentThesis" value={form.investmentThesis} onChange={change} placeholder="What kinds of founders and ideas do you back?" required minLength={20} maxLength={2000} error={fieldErrors.investmentThesis} hint="20–2,000 characters." />
        <Field label="Short bio" name="biography" value={form.biography} onChange={change} placeholder="A little about your experience" />
        <MultiChoice name="industriesOfInterest" label="Industries of interest" choices={industries} value={form.industriesOfInterest} onChange={(value) => update('industriesOfInterest', value)} error={fieldErrors.industriesOfInterest} />
        <MultiChoice name="preferredFundingStages" label="Preferred funding stages" choices={stages} value={form.preferredFundingStages} onChange={(value) => update('preferredFundingStages', value)} error={fieldErrors.preferredFundingStages} />
        <div className="triple-column"><Field label="Minimum" name="minInvestment" type="number" min="0" max="1000000000000" value={form.minInvestment} onChange={change} placeholder="25,000" required error={fieldErrors.minInvestment} /><Field label="Maximum" name="maxInvestment" type="number" min="0" max="1000000000000" value={form.maxInvestment} onChange={change} placeholder="250,000" required error={fieldErrors.maxInvestment} /><SelectField label="Currency" name="currency" value={form.currency} onChange={change} options={['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']} /></div>
        <Field label="Preferred locations" name="preferredStartupLocations" value={form.preferredStartupLocations} onChange={change} placeholder="e.g. New York, India (comma separated)" hint="Enter 1–20 locations separated by commas." error={fieldErrors.preferredStartupLocations} />
        <div className="two-column"><Field label="Website" name="website" type="url" value={form.website} onChange={change} placeholder="https://" /><Field label="LinkedIn URL" name="linkedInUrl" type="url" value={form.linkedInUrl} onChange={change} placeholder="https://linkedin.com/in/..." /></div>
      </>}
      {founder && step === 1 && <>
        <div className="two-column"><Field label="Startup name" name="name" value={form.name} onChange={change} placeholder="Company or startup name" required /><Field label="Your designation" name="founderDesignation" value={form.founderDesignation} onChange={change} placeholder="Founder & CEO" required /></div>
        <div className="two-column"><SelectField label="Industry" name="industry" value={form.industry} onChange={change} options={['', ...industries]} required /><SelectField label="Funding stage" name="fundingStage" value={form.fundingStage} onChange={change} options={stages} required /></div>
        <Field label="Company description" name="description" value={form.description} onChange={change} placeholder="What problem are you solving?" required />
        <div className="two-column"><Field label="Company location" name="location" value={form.location} onChange={change} placeholder="City, country" /><Field label="Website" name="website" type="url" value={form.website} onChange={change} placeholder="https://" /></div>
        <div className="two-column"><Field label="Founding year" name="foundedYear" type="number" min="1900" max={new Date().getFullYear()} value={form.foundedYear} onChange={change} placeholder="2024" required /><Field label="Team size" name="teamSize" type="number" min="1" value={form.teamSize} onChange={change} placeholder="5" required /></div>
        <div className="two-column"><Field label="Business model" name="businessModel" value={form.businessModel} onChange={change} placeholder="e.g. SaaS" required /><Field label="Target market" name="targetMarket" value={form.targetMarket} onChange={change} placeholder="Who do you serve?" required /></div>
      </>}
      {founder && step === 2 && <>
        <div className="funding-callout"><span>↗</span><p><strong>Your financial details are private by default.</strong><br />You control what is shared with investors later.</p></div>
        <div className="two-column"><Field label="Funding target" name="fundingGoal" type="number" min="0" value={form.fundingGoal} onChange={change} placeholder="500000" required /><Field label="Amount already raised" name="fundingRaised" type="number" min="0" value={form.fundingRaised} onChange={change} placeholder="Optional" /></div>
        <div className="two-column"><Field label="Annual turnover (revenue)" name="annualTurnover" type="number" min="0" value={form.annualTurnover} onChange={change} placeholder="Optional" hint="Revenue during a financial year; not profit, valuation, or funding raised." /><SelectField label="Turnover currency" name="turnoverCurrency" value={form.turnoverCurrency} onChange={change} options={['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']} /></div>
        <Field label="Financial year (e.g. FY2025)" name="financialYear" value={form.financialYear} onChange={change} placeholder="Optional" />
        <div className="two-column"><Field label="Product or service name" name="productName" value={form.productName} onChange={change} placeholder="What do you offer?" required /><Field label="Product description" name="productDescription" value={form.productDescription} onChange={change} placeholder="What makes it valuable?" required /></div>
      </>}
      {error && <div className="alert error" role="alert">{error}</div>}
      <div className="form-actions">{step > 0 && <button type="button" className="secondary-button" onClick={() => { setStep(step - 1); setError(''); }}>← Back</button>}<button className="primary-button" disabled={busy}>{busy ? 'Creating your account…' : step < total - 1 ? 'Continue' : 'Create account'} <span>{step < total - 1 ? '→' : '✓'}</span></button></div>
    </form>
    <div className="form-bottom">Already have an account? <button type="button" className="text-button" onClick={onLogin}>Sign in <span>→</span></button></div>
  </AuthLayout>;
}

export default function App() {
  const initial = useMemo(readRoute, []);
  const [route, setRoute] = useState(initial);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(() => window.localStorage.getItem(SESSION_HINT) === '1');

  useEffect(() => {
    const syncRoute = () => setRoute(readRoute());
    window.addEventListener('hashchange', syncRoute);
    if (window.localStorage.getItem(SESSION_HINT) === '1') {
      let active = true;
      restoreSession()
        .then((result) => {
          const restoredUser = result.user ?? result.data?.user ?? null;
          if (!active) return;
          if (restoredUser) setUser(restoredUser);
          else window.localStorage.removeItem(SESSION_HINT);
        })
        .catch(() => {
          if (active) window.localStorage.removeItem(SESSION_HINT);
        })
        .finally(() => { if (active) setChecking(false); });
      return () => { active = false; window.removeEventListener('hashchange', syncRoute); };
    }
    setChecking(false);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  useEffect(() => { document.title = 'StartupScout — Find your next opportunity'; }, []);

  async function signOut() {
    try { await authApi.logout(); } finally { window.localStorage.removeItem(SESSION_HINT); setUser(null); go('login', 'investor'); }
  }
  function authenticated(user) {
    window.localStorage.setItem(SESSION_HINT, '1');
    setUser(user);
  }
  function setRole(role) { go(route.page, role); }
  if (checking) return <div className="loading-screen"><Brand /><span>Preparing your space…</span></div>;
  if (user) return <Workspace user={user} onSignOut={signOut} />;
  if (route.page === 'register' && route.role !== 'admin') return <Registration role={route.role} onRoleChange={setRole} onLogin={() => go('login', route.role)} onRegistered={() => go('login', route.role)} />;
  return <Login role={route.role} onRoleChange={setRole} onAuthenticated={authenticated} onRegister={() => go('register', route.role)} />;
}
