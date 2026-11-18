import { useEffect, useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import {
  Activity, ArrowDownToLine, ArrowRight, Bell, BookOpenCheck, BriefcaseBusiness,
  Check, ChevronDown, CircleHelp, CirclePlay, Clock3, Code2, FileChartColumn,
  Filter, FlaskConical, Gauge, LayoutDashboard, Layers3, LoaderCircle, Moon,
  Pencil, Play, Plus, RefreshCw, Search, Settings, ShieldCheck,
  TableProperties, Trash2, Users, X, Zap
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';
import './App.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const apiOrigin = apiBaseUrl.replace(/\/api\/?$/, '');
const api = axios.create({ baseURL: apiBaseUrl, timeout: 10000 });

type Page = 'Overview' | 'Test Suites' | 'Test Cases' | 'Test Execution' | 'Test Reports' | 'API Testing' | 'Test Data' | 'Integrations' | 'Settings';
type Suite = { id: number; name: string; description: string; module: string; enabled: boolean; createdAt?: string };
type TestCase = {
  id: number;
  caseId: string;
  name: string;
  module: string;
  description: string;
  preconditions: string;
  testSteps: string;
  expectedResult: string;
  priority: string;
  testType: string;
  automationStatus: string;
  suiteId: number | null;
};
type Execution = {
  id: number;
  suiteId: number | null;
  suiteName: string;
  environment: string;
  browser: string;
  mode: string;
  status: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  currentTest?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs: number;
};
type TestResult = {
  id: number;
  caseId: string;
  testName: string;
  module: string;
  status: string;
  durationMs: number;
  errorMessage: string;
  logs: string;
  screenshotPath?: string;
};
type Employee = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  jobTitle: string;
  joiningDate: string;
  status: string;
};
type Summary = {
  totalTestCases: number;
  passedTests: number;
  failedTests: number;
  successRate: number;
  averageExecutionTimeMs: number;
  activeSuites: number;
  totalExecutions: number;
};

const navigation: { label: Page; icon: typeof LayoutDashboard; group: string }[] = [
  { label: 'Overview', icon: LayoutDashboard, group: 'WORKSPACE' },
  { label: 'Test Suites', icon: Layers3, group: 'WORKSPACE' },
  { label: 'Test Cases', icon: TableProperties, group: 'WORKSPACE' },
  { label: 'Test Execution', icon: CirclePlay, group: 'WORKSPACE' },
  { label: 'Test Reports', icon: FileChartColumn, group: 'INSIGHTS' },
  { label: 'API Testing', icon: Code2, group: 'INSIGHTS' },
  { label: 'Test Data', icon: BriefcaseBusiness, group: 'CONFIGURATION' },
  { label: 'Integrations', icon: Activity, group: 'CONFIGURATION' },
  { label: 'Settings', icon: Settings, group: 'CONFIGURATION' }
];

const emptySummary: Summary = {
  totalTestCases: 0, passedTests: 0, failedTests: 0, successRate: 0,
  averageExecutionTimeMs: 0, activeSuites: 0, totalExecutions: 0
};

const errorText = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    return typeof message === 'string' ? message : error.message;
  }
  return error instanceof Error ? error.message : 'Something unexpected happened.';
};

const runLabel = (id: number) => `RUN-${String(id).padStart(4, '0')}`;
const dateLabel = (value?: string) => value ? new Date(value).toLocaleString() : 'Not started';
const durationLabel = (milliseconds: number) => milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(1)} s`;
const statusClass = (value: string) => `status status-${value.toLowerCase().replace(/[^a-z]+/g, '-')}`;
const executionModeLabel = (value: string) => value === 'MANUAL' ? 'Manual review' : value.startsWith('SELENIUM') ? 'Selenium' : value;
const initials = (firstName: string, lastName: string) => `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

function App() {
  const [page, setPage] = useState<Page>('Overview');
  const [collapsed, setCollapsed] = useState(false);
  const [environment, setEnvironment] = useState(() => localStorage.getItem('ef-environment') || 'Development');
  const [theme, setTheme] = useState(() => localStorage.getItem('ef-theme') || 'light');
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('Waiting for first sync');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [suiteDraft, setSuiteDraft] = useState<Partial<Suite> | null>(null);
  const [caseDraft, setCaseDraft] = useState<Partial<TestCase> | null>(null);
  const [employeeDraft, setEmployeeDraft] = useState<Partial<Employee> | null>(null);
  const [selectedSuiteId, setSelectedSuiteId] = useState('');
  const [executionType, setExecutionType] = useState<'MANUAL' | 'SELENIUM'>('MANUAL');
  const [selectedBrowser, setSelectedBrowser] = useState('Chrome');
  const [executionMode, setExecutionMode] = useState('Headless');
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [executionResults, setExecutionResults] = useState<TestResult[]>([]);
  const [overviewReport, setOverviewReport] = useState<{ executionId: number; results: TestResult[] } | null>(null);
  const [apiProbe, setApiProbe] = useState('/health');
  const [probeResult, setProbeResult] = useState<{ status: number; elapsed: number; data: unknown } | null>(null);
  const [probing, setProbing] = useState(false);
  const [healthCheckedAt, setHealthCheckedAt] = useState('');
  const latestExecution = executions[0] ?? null;
  const latestExecutionId = latestExecution?.id;
  const latestExecutionStatus = latestExecution?.status;
  const overviewResults = overviewReport && overviewReport.executionId === latestExecutionId ? overviewReport.results : [];
  const liveExecution = executions.find(execution => execution.status === 'RUNNING') ?? latestExecution;

  const refreshWorkspace = async () => {
    try {
      const [summaryResponse, suitesResponse, casesResponse, executionsResponse, employeesResponse] = await Promise.all([
        api.get<Summary>('/dashboard/summary'),
        api.get<Suite[]>('/suites'),
        api.get<TestCase[]>('/test-cases'),
        api.get<Execution[]>('/executions'),
        api.get<Employee[]>('/employees')
      ]);
      setSummary(summaryResponse.data);
      setSuites(suitesResponse.data);
      setCases(casesResponse.data);
      setExecutions([...executionsResponse.data].sort((a, b) => (b.id || 0) - (a.id || 0)));
      setEmployees(employeesResponse.data);
      setApiOnline(true);
      setError('');
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (requestError) {
      setApiOnline(false);
      setError(`Could not load workspace data: ${errorText(requestError)}. Check that the backend is running on port 8080.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(refreshWorkspace);
  }, []);

  useEffect(() => {
    localStorage.setItem('ef-environment', environment);
  }, [environment]);

  useEffect(() => {
    localStorage.setItem('ef-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!selectedExecution) return;
    let active = true;
    api.get<TestResult[]>(`/executions/${selectedExecution.id}/results`)
      .then(response => { if (active) setExecutionResults(response.data); })
      .catch(requestError => { if (active) setError(`Could not load run results: ${errorText(requestError)}`); });
    return () => { active = false; };
  }, [selectedExecution]);

  useEffect(() => {
    if (latestExecutionId === undefined) return;
    let active = true;
    api.get<TestResult[]>(`/executions/${latestExecutionId}/results`)
      .then(response => { if (active) setOverviewReport({ executionId: latestExecutionId, results: response.data }); })
      .catch(requestError => { if (active) setError(`Could not load the latest report: ${errorText(requestError)}`); });
    return () => { active = false; };
  }, [latestExecutionId, latestExecutionStatus]);

  useEffect(() => {
    if (page !== 'Overview' || liveExecution?.status !== 'RUNNING') return;
    let active = true;
    const timer = window.setInterval(() => {
      api.get<Execution>(`/executions/${liveExecution.id}`)
        .then(response => {
          if (!active) return;
          setExecutions(current => current.map(item => item.id === response.data.id ? response.data : item));
          setSelectedExecution(current => current?.id === response.data.id ? response.data : current);
        })
        .catch(requestError => {
          if (active) setError(`Could not refresh the live run: ${errorText(requestError)}`);
        });
    }, 1500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [page, liveExecution?.id, liveExecution?.status]);

  const selectedExecutionId = selectedExecution?.id;
  const selectedExecutionMode = selectedExecution?.mode;
  const selectedExecutionStatus = selectedExecution?.status;
  useEffect(() => {
    if (selectedExecutionId === undefined || selectedExecutionMode === 'MANUAL' || !['QUEUED', 'RUNNING'].includes(selectedExecutionStatus || '')) return;
    const timer = window.setInterval(() => {
      api.get<Execution>(`/executions/${selectedExecutionId}`)
        .then(response => {
          setSelectedExecution(current => current?.id === response.data.id ? response.data : current);
          setExecutions(current => current.map(item => item.id === response.data.id ? response.data : item));
        })
        .catch(requestError => setError(`Could not refresh Selenium run: ${errorText(requestError)}`));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [selectedExecutionId, selectedExecutionMode, selectedExecutionStatus]);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(current => current === message ? '' : current), 3500);
  };

  const showError = (action: string, requestError: unknown) => {
    setError(`${action}: ${errorText(requestError)}`);
  };

  const selectExecution = (execution: Execution) => {
    setExecutionResults([]);
    setSelectedExecution(execution);
  };

  const saveManualResult = async (execution: Execution, testCase: TestCase, status: string, note: string): Promise<boolean> => {
    try {
      await api.post(`/executions/${execution.id}/results`, {
        caseId: testCase.caseId,
        testName: testCase.name,
        module: testCase.module || 'General',
        status,
        durationMs: 0,
        errorMessage: status === 'FAILED' ? note : '',
        logs: note
      });
      const [executionResponse, resultsResponse] = await Promise.all([
        api.get<Execution>(`/executions/${execution.id}`),
        api.get<TestResult[]>(`/executions/${execution.id}/results`)
      ]);
      setSelectedExecution(executionResponse.data);
      setExecutions(current => current.map(item => item.id === execution.id ? executionResponse.data : item));
      setExecutionResults(resultsResponse.data);
      await refreshWorkspace();
      notify(`${testCase.caseId} result saved.`);
      return true;
    } catch (requestError) {
      showError(`Could not save result for ${testCase.caseId}`, requestError);
      return false;
    }
  };

  const saveSuite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!suiteDraft?.name?.trim()) {
      setError('Suite name is required.');
      return;
    }
    try {
      const payload = {
        name: suiteDraft.name.trim(),
        description: suiteDraft.description?.trim() || '',
        module: suiteDraft.module?.trim() || 'General',
        enabled: suiteDraft.enabled ?? true
      };
      if (suiteDraft.id) await api.put(`/suites/${suiteDraft.id}`, payload);
      else await api.post('/suites', payload);
      setSuiteDraft(null);
      await refreshWorkspace();
      notify(suiteDraft.id ? 'Suite updated.' : 'Suite created.');
    } catch (requestError) {
      showError('Could not save suite', requestError);
    }
  };

  const deleteSuite = async (suite: Suite) => {
    if (!window.confirm(`Delete "${suite.name}"?`)) return;
    try {
      await api.delete(`/suites/${suite.id}`);
      if (selectedSuiteId === String(suite.id)) setSelectedSuiteId('');
      await refreshWorkspace();
      notify('Suite deleted.');
    } catch (requestError) {
      showError('Could not delete suite', requestError);
    }
  };

  const saveCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!caseDraft?.name?.trim() || !caseDraft.caseId?.trim()) {
      setError('Case ID and test case name are required.');
      return;
    }
    try {
      const payload = {
        caseId: caseDraft.caseId.trim(),
        name: caseDraft.name.trim(),
        module: caseDraft.module?.trim() || 'General',
        description: caseDraft.description?.trim() || '',
        preconditions: caseDraft.preconditions?.trim() || '',
        testSteps: caseDraft.testSteps?.trim() || '',
        expectedResult: caseDraft.expectedResult?.trim() || '',
        priority: caseDraft.priority || 'Medium',
        testType: caseDraft.testType || 'Functional',
        automationStatus: caseDraft.automationStatus || 'MANUAL',
        suiteId: caseDraft.suiteId || null
      };
      if (caseDraft.id) await api.put(`/test-cases/${caseDraft.id}`, payload);
      else await api.post('/test-cases', payload);
      setCaseDraft(null);
      await refreshWorkspace();
      notify(caseDraft.id ? 'Test case updated.' : 'Test case created.');
    } catch (requestError) {
      showError('Could not save test case', requestError);
    }
  };

  const deleteCase = async (testCase: TestCase) => {
    if (!window.confirm(`Delete ${testCase.caseId} - ${testCase.name}?`)) return;
    try {
      await api.delete(`/test-cases/${testCase.id}`);
      await refreshWorkspace();
      notify('Test case deleted.');
    } catch (requestError) {
      showError('Could not delete test case', requestError);
    }
  };

  const launchExecution = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const suite = suites.find(item => String(item.id) === selectedSuiteId);
    const suiteCases = cases.filter(testCase => !suite || testCase.suiteId === suite.id);
    if (executionType === 'MANUAL' && suiteCases.length === 0) {
      setError('There are no test cases in this suite yet.');
      return;
    }
    if (executionType === 'SELENIUM' && (!suite || !cases.some(testCase => testCase.caseId === 'TC_AUTH_001' && testCase.suiteId === suite.id))) {
      setError('Choose the suite assigned to TC_AUTH_001 to run the current Selenium check.');
      return;
    }
    try {
      const response = await api.post<Execution>('/executions', {
        suiteId: suite?.id ?? null,
        suiteName: suite?.name ?? 'Complete Regression Suite',
        environment,
        browser: executionType === 'SELENIUM' ? 'Chrome' : selectedBrowser,
        mode: executionType === 'MANUAL' ? 'MANUAL' : `SELENIUM_${executionMode.toUpperCase()}`
      });
      let nextExecution = response.data;
      if (executionType === 'MANUAL') {
        const startedAt = response.data.startedAt || new Date().toISOString();
        const startedResponse = await api.put<Execution>(`/executions/${response.data.id}`, {
          ...response.data,
          status: 'RUNNING',
          totalTests: suiteCases.length,
          currentTest: suiteCases[0]?.name || null,
          startedAt
        });
        nextExecution = startedResponse.data;
      } else {
        const runnerResponse = await api.post<Execution>(`/executions/${response.data.id}/run-selenium`);
        nextExecution = runnerResponse.data;
      }
      selectExecution(nextExecution);
      await refreshWorkspace();
      setPage('Test Execution');
      notify(executionType === 'MANUAL' ? `${runLabel(response.data.id)} is ready for manual review.` : `${runLabel(response.data.id)} started in Selenium.`);
    } catch (requestError) {
      showError('Could not queue execution', requestError);
    }
  };

  const cancelExecution = async (execution: Execution) => {
    try {
      const response = await api.post<Execution>(`/executions/${execution.id}/cancel`);
      selectExecution(response.data);
      await refreshWorkspace();
      notify(`${runLabel(execution.id)} cancelled.`);
    } catch (requestError) {
      showError('Could not cancel execution', requestError);
    }
  };

  const saveEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employeeDraft?.employeeId?.trim() || !employeeDraft.firstName?.trim() || !employeeDraft.email?.trim()) {
      setError('Employee ID, first name, and email are required.');
      return;
    }
    try {
      const payload = {
        employeeId: employeeDraft.employeeId.trim(),
        firstName: employeeDraft.firstName.trim(),
        lastName: employeeDraft.lastName?.trim() || '',
        email: employeeDraft.email.trim(),
        phone: employeeDraft.phone?.trim() || '',
        department: employeeDraft.department?.trim() || '',
        jobTitle: employeeDraft.jobTitle?.trim() || '',
        joiningDate: employeeDraft.joiningDate || null,
        status: employeeDraft.status || 'Active'
      };
      if (employeeDraft.id) await api.put(`/employees/${employeeDraft.id}`, payload);
      else await api.post('/employees', payload);
      setEmployeeDraft(null);
      await refreshWorkspace();
      notify(employeeDraft.id ? 'Employee updated.' : 'Employee added to test data.');
    } catch (requestError) {
      showError('Could not save employee', requestError);
    }
  };

  const deleteEmployee = async (employee: Employee) => {
    if (!window.confirm(`Delete ${employee.firstName} ${employee.lastName}?`)) return;
    try {
      await api.delete(`/employees/${employee.id}`);
      await refreshWorkspace();
      notify('Employee removed from test data.');
    } catch (requestError) {
      showError('Could not delete employee', requestError);
    }
  };

  const runApiProbe = async () => {
    setProbing(true);
    setProbeResult(null);
    const started = performance.now();
    try {
      const response = await api.get(apiProbe);
      setProbeResult({ status: response.status, elapsed: Math.round(performance.now() - started), data: response.data });
    } catch (requestError) {
      if (axios.isAxiosError(requestError) && requestError.response) {
        setProbeResult({
          status: requestError.response.status,
          elapsed: Math.round(performance.now() - started),
          data: requestError.response.data
        });
      } else {
        showError('API request failed', requestError);
      }
    } finally {
      setProbing(false);
    }
  };

  const checkHealth = async () => {
    try {
      await api.get('/health');
      setApiOnline(true);
      setError('');
      setHealthCheckedAt(new Date().toLocaleTimeString());
      notify('EnterpriseFlow API is responding.');
    } catch (requestError) {
      setApiOnline(false);
      showError('API health check failed', requestError);
    }
  };

  const filteredSuites = useMemo(() => suites.filter(suite =>
    `${suite.name} ${suite.description} ${suite.module}`.toLowerCase().includes(query.toLowerCase())), [suites, query]);
  const filteredCases = useMemo(() => cases.filter(testCase =>
    `${testCase.caseId} ${testCase.name} ${testCase.module} ${testCase.description}`.toLowerCase().includes(query.toLowerCase())), [cases, query]);
  const filteredExecutions = useMemo(() => executions.filter(execution =>
    `${execution.suiteName} ${execution.environment} ${execution.status} ${execution.id}`.toLowerCase().includes(query.toLowerCase())), [executions, query]);
  const latestExecutions = executions.slice(0, 6);
  const moduleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    cases.forEach(testCase => counts.set(testCase.module || 'General', (counts.get(testCase.module || 'General') ?? 0) + 1));
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [cases]);
  const trend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      return { key, day: date.toLocaleDateString(undefined, { weekday: 'short' }), passed: 0, failed: 0, runs: 0 };
    });
    executions.forEach(execution => {
      if (!execution.startedAt) return;
      const date = new Date(execution.startedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const day = days.find(item => item.key === key);
      if (day) {
        day.passed += execution.passedTests;
        day.failed += execution.failedTests;
        day.runs += 1;
      }
    });
    return days;
  }, [executions]);
  const hasRecentOutcomes = trend.some(day => day.passed > 0 || day.failed > 0);
  const reviewedChecks = summary.passedTests + summary.failedTests;
  const pendingRuns = executions.filter(execution => ['QUEUED', 'RUNNING'].includes(execution.status)).length;

  const openNewCase = () => setCaseDraft({
    caseId: `TC-${Date.now().toString().slice(-6)}`,
    name: '',
    module: '',
    description: '',
    preconditions: '',
    testSteps: '',
    expectedResult: '',
    priority: 'Medium',
    testType: 'Functional',
    automationStatus: 'MANUAL',
    suiteId: null
  });

  const openSeleniumSetup = () => {
    const loginCase = cases.find(testCase => testCase.caseId === 'TC_AUTH_001');
    if (loginCase?.suiteId) setSelectedSuiteId(String(loginCase.suiteId));
    setExecutionType('SELENIUM');
    setPage('Test Execution');
  };

  const exportReport = (execution: Execution) => {
    const rows = [
      ['Record', 'Run ID', 'Suite', 'Environment', 'Status', 'Total', 'Passed', 'Failed', 'Skipped', 'Started', 'Case ID', 'Test name', 'Module', 'Duration (ms)', 'Error', 'Logs', 'Screenshot URL'],
      ['Summary', runLabel(execution.id), execution.suiteName, execution.environment, execution.status,
        execution.totalTests, execution.passedTests, execution.failedTests, execution.skippedTests, dateLabel(execution.startedAt), '', '', '', '', '', '', ''],
      ...(selectedExecution?.id === execution.id ? executionResults : []).map(result => [
        'Test result', runLabel(execution.id), execution.suiteName, execution.environment, result.status,
        '', '', '', '', '', result.caseId, result.testName, result.module, result.durationMs, result.errorMessage, result.logs,
        result.screenshotPath ? `${apiBaseUrl}/executions/${execution.id}/results/${result.id}/screenshot` : ''
      ])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${runLabel(execution.id).toLowerCase()}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`app-shell theme-${theme}`}>
      <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={19} /></div>
          {!collapsed && <div className="brand-copy"><strong>EnterpriseFlow</strong><small>QUALITY ENGINEERING</small></div>}
          <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
            <ChevronDown size={15} />
          </button>
        </div>
        <nav className="navigation" aria-label="Main navigation">
          {['WORKSPACE', 'INSIGHTS', 'CONFIGURATION'].map(group => (
            <div className="nav-group" key={group}>
              {!collapsed && <div className="nav-label">{group}</div>}
              {navigation.filter(item => item.group === group).map(({ label, icon: Icon }) => (
                <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => setPage(label)} title={label} aria-label={label}>
                  <Icon size={17} strokeWidth={1.8} />{!collapsed && <span>{label}</span>}
                  {!collapsed && label === 'Test Execution' && executions.some(item => item.status === 'QUEUED') && <i className="nav-dot" />}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-state"><span className={`health-dot ${apiOnline ? 'online' : ''}`} />{!collapsed && <span>{apiOnline ? 'API connected' : 'API unavailable'}</span>}</div>
          {!collapsed && <div className="profile"><div className="avatar">PS</div><div><strong>Priyam S.</strong><small>Workspace admin</small></div><ChevronDown size={14} /></div>}
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{page}</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
              if (event.key !== 'Enter' || !query) return;
              const term = query.toLowerCase();
              if (cases.some(testCase => `${testCase.caseId} ${testCase.name} ${testCase.module}`.toLowerCase().includes(term))) setPage('Test Cases');
              else if (suites.some(suite => `${suite.name} ${suite.module}`.toLowerCase().includes(term))) setPage('Test Suites');
              else if (executions.some(execution => `${execution.suiteName} ${execution.id} ${execution.status}`.toLowerCase().includes(term))) setPage('Test Reports');
              else setPage('Test Cases');
            }} placeholder="Search suites, test cases, runs..." /><kbd>Enter</kbd></label>
            <label className="environment-picker"><span>ENV</span><select aria-label="Environment" value={environment} onChange={event => setEnvironment(event.target.value)}><option>Development</option><option>Staging</option><option>Production</option></select></label>
            <button className="icon-action" title="Refresh workspace" onClick={() => void refreshWorkspace()}><RefreshCw size={17} /></button>
            <button className="icon-action notification-action" title="Notifications" onClick={() => setPage('Test Execution')}><Bell size={17} />{executions.some(item => item.status === 'QUEUED') && <i />}</button>
            <div className="avatar top-avatar" title="Priyam S.">PS</div>
          </div>
        </header>

        {error && <div className="feedback feedback-error" role="alert"><CircleHelp size={17} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
        {notice && <div className="feedback feedback-success" role="status"><Check size={17} /><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={16} /></button></div>}

        <div className="content">
          {loading ? <div className="loading-state"><LoaderCircle className="spin" size={22} />Connecting to your workspace...</div> : null}
          {!loading && page === 'Overview' && (
            <>
              <section className="overview-heading">
                <div>
                  <div className="section-kicker">QUALITY DASHBOARD</div>
                  <h1>Test results at a glance</h1>
                  <p>See what is covered, what is running, and which checks need attention.</p>
                </div>
                <div className="overview-heading-actions">
                  <button className="button button-outline" onClick={() => setPage('Test Cases')}><TableProperties size={15} />Manage tests</button>
                  <button className="button button-primary" onClick={openSeleniumSetup}><Play size={15} />Run Selenium login</button>
                  <div className={`overview-connection ${apiOnline ? 'is-online' : ''}`}>
                    <span className={`health-dot ${apiOnline ? 'online' : ''}`} />
                    <span><strong>{apiOnline ? 'Backend connected' : 'Backend unavailable'}</strong><small>Last sync: {lastRefreshed}</small></span>
                    <button className="icon-action" title="Refresh workspace" aria-label="Refresh workspace" onClick={() => void refreshWorkspace()}><RefreshCw size={16} /></button>
                  </div>
                </div>
              </section>

              <section className="metric-grid overview-metrics" aria-label="Workspace summary">
                <Metric icon={TableProperties} label="Test cases" value={summary.totalTestCases} note="Scenarios ready to review" color="violet" />
                <Metric icon={Layers3} label="Test suites" value={summary.activeSuites} note="Groups of related checks" color="teal" />
                <Metric icon={CirclePlay} label="Total runs" value={summary.totalExecutions} note={pendingRuns ? `${pendingRuns} waiting or running` : 'Saved execution history'} color="blue" />
                <Metric icon={Gauge} label="Pass rate" value={reviewedChecks ? `${summary.successRate}%` : '—'} note={reviewedChecks ? `${summary.passedTests} passed · ${summary.failedTests} failed` : 'Shown after results are saved'} color="amber" />
              </section>

              <section className="dashboard-grid">
                <article className="card chart-card trend-card">
                  <div className="section-heading"><div><div className="section-kicker">EXECUTION ACTIVITY</div><h2>Run outcomes</h2><p>Actual passed and failed checks over the last 7 days</p></div><span className="subtle-chip"><Clock3 size={13} />7 days</span></div>
                  {hasRecentOutcomes ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}><defs><linearGradient id="passFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d9b78" stopOpacity={0.24} /><stop offset="95%" stopColor="#0d9b78" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#e9edf3" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#8a94a5', fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#8a94a5', fontSize: 11 }} /><Tooltip contentStyle={{ background: '#142238', border: '1px solid #263a56', borderRadius: 10, color: '#fff' }} /><Area type="monotone" dataKey="passed" name="Passed" stroke="#0d9b78" strokeWidth={2.5} fill="url(#passFill)" /><Area type="monotone" dataKey="failed" name="Failed" stroke="#d65c68" strokeWidth={2.5} fill="transparent" /></AreaChart></ResponsiveContainer></div> : <EmptyState icon={CirclePlay} title={pendingRuns ? 'Runs are waiting for results' : 'No results recorded this week'} description={pendingRuns ? 'A queued run is only a record so far. Start a manual review and save Pass, Fail, or Skip for each case.' : 'After a run is reviewed, its pass and fail results will appear here.'} action={<button className="button button-primary button-small" onClick={() => setPage('Test Execution')}><Play size={14} />Start a manual review</button>} compact />}
                  <div className="chart-legend"><span><i className="legend-pass" />Passed checks</span><span><i className="legend-fail" />Failed checks</span><span><i className="legend-run" />{executions.length} runs total</span></div>
                </article>
                <article className="card chart-card module-card">
                  <div className="section-heading"><div><div className="section-kicker">COVERAGE MAP</div><h2>Cases by module</h2><p>Where your test coverage lives</p></div><button className="icon-action small-action" title="View test cases" onClick={() => setPage('Test Cases')}><ArrowRight size={16} /></button></div>
                  {moduleCounts.length ? <div className="module-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={moduleCounts} layout="vertical" margin={{ top: 4, right: 15, left: 0, bottom: 0 }}><CartesianGrid stroke="#edf0f5" horizontal={false} /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#8a94a5', fontSize: 10 }} /><YAxis type="category" dataKey="name" width={112} tickLine={false} axisLine={false} tick={{ fill: '#69758a', fontSize: 10 }} /><Tooltip cursor={{ fill: '#f3f6f9' }} contentStyle={{ background: '#142238', border: '1px solid #263a56', borderRadius: 10, color: '#fff' }} /><Bar dataKey="count" name="Test cases" fill="#6573d8" radius={[0, 5, 5, 0]} barSize={13} /></BarChart></ResponsiveContainer></div> : <EmptyState icon={Layers3} title="No coverage mapped" description="Add cases and assign a module to see coverage." compact /> }
                  <div className="module-footer"><span>{cases.length} cases tracked</span><button className="text-button" onClick={() => setPage('Test Cases')}>Manage cases <ArrowRight size={13} /></button></div>
                </article>
              </section>

              <section className="overview-focus-grid">
                <article className="card overview-live-card">
                  <div className="section-heading"><div><div className="section-kicker">LIVE EXECUTION</div><h2>Current run</h2><p>Follow the newest active or completed run.</p></div><Activity size={18} /></div>
                  {liveExecution ? <>
                    <div className="overview-run-title"><div><span className="case-id">{runLabel(liveExecution.id)}</span><strong>{liveExecution.suiteName || 'Unnamed suite'}</strong></div><Status value={liveExecution.status || 'UNKNOWN'} /></div>
                    <div className="overview-run-meta">{liveExecution.environment} · {liveExecution.browser} · {executionModeLabel(liveExecution.mode || 'Unknown')}</div>
                    {liveExecution.status === 'RUNNING' && <div className="overview-current-test"><span className="health-dot online" />{liveExecution.currentTest || 'Starting browser check…'}</div>}
                    <div className="overview-run-counts"><span><strong className="text-green">{liveExecution.passedTests}</strong> passed</span><span><strong className="text-red">{liveExecution.failedTests}</strong> failed</span><span><strong>{liveExecution.totalTests}</strong> total checks</span></div>
                    <div className="overview-run-footer"><span>{liveExecution.status === 'RUNNING' ? 'Status refreshes automatically' : `Started ${dateLabel(liveExecution.startedAt)}`}</span><button className="text-button" onClick={() => { selectExecution(liveExecution); setPage('Test Execution'); }}>Open run <ArrowRight size={13} /></button></div>
                  </> : <EmptyState icon={CirclePlay} title="No runs yet" description="Start a manual review or the Selenium login check to see progress here." action={<button className="button button-primary button-small" onClick={openSeleniumSetup}><Play size={14} />Set up a run</button>} compact />}
                </article>

                <article className="card overview-evidence-card">
                  <div className="section-heading"><div><div className="section-kicker">LATEST REPORT</div><h2>Test evidence</h2><p>Saved result, run log, and browser screenshot.</p></div><button className="icon-action small-action" title="View all reports" onClick={() => setPage('Test Reports')}><ArrowRight size={16} /></button></div>
                  {overviewResults.length ? <div className="overview-evidence-list">{overviewResults.map(result => <div className="overview-evidence-item" key={result.id}>
                    <div className="overview-evidence-title"><div><Status value={result.status || 'UNKNOWN'} /><strong>{result.testName || result.caseId || 'Unnamed test'}</strong></div><small>{durationLabel(result.durationMs || 0)}</small></div>
                    <p>{result.logs || result.errorMessage || 'No execution log was saved.'}</p>
                    {result.screenshotPath && <a className="overview-screenshot" href={`${apiBaseUrl}/executions/${latestExecution?.id}/results/${result.id}/screenshot`} target="_blank" rel="noreferrer"><img src={`${apiBaseUrl}/executions/${latestExecution?.id}/results/${result.id}/screenshot`} alt={`Screenshot for ${result.testName || result.caseId}`} /><span>Open screenshot <ArrowRight size={13} /></span></a>}
                  </div>)}</div> : <div className="overview-no-evidence"><CircleHelp size={18} /><div><strong>{latestExecution ? 'No saved test results yet' : 'No report evidence yet'}</strong><span>{latestExecution?.status === 'QUEUED' ? 'This run is queued; it will not show a pass or fail until checks have run.' : 'Run a check to record its outcome, execution log, and screenshot.'}</span><button className="text-button" onClick={latestExecution ? () => setPage('Test Reports') : openSeleniumSetup}>{latestExecution ? 'Open reports' : 'Run Selenium login'} <ArrowRight size={13} /></button></div></div>}
                </article>
              </section>

              <section className="card table-card">
                <div className="section-heading table-heading"><div><div className="section-kicker">LATEST ACTIVITY</div><h2>Recent test runs</h2><p>Review the latest execution records</p></div><button className="button button-outline" onClick={() => setPage('Test Reports')}>All reports <ArrowRight size={15} /></button></div>
                {latestExecutions.length ? <ExecutionTable executions={latestExecutions} onSelect={execution => { selectExecution(execution); setPage('Test Reports'); }} /> : <EmptyState icon={CirclePlay} title="No runs yet" description="Queue your first run to start building an execution history." action={<button className="button button-primary" onClick={() => setPage('Test Execution')}><Play size={15} />Set up a run</button>} />}
              </section>
            </>
          )}

          {!loading && page === 'Test Suites' && (
            <>
              <PageHeader kicker="TEST MANAGEMENT" title="Test suites" description="Group related scenarios into suites and keep coverage organized." action={<button className="button button-primary" onClick={() => setSuiteDraft({ name: '', description: '', module: '', enabled: true })}><Plus size={16} />Create suite</button>} />
              <div className="toolbar"><div className="toolbar-copy"><Layers3 size={16} /><strong>{filteredSuites.length}</strong><span>suite{filteredSuites.length === 1 ? '' : 's'}</span></div><div className="toolbar-note"><Filter size={14} />Search filters this list</div></div>
              {filteredSuites.length ? <div className="suite-grid">{filteredSuites.map(suite => <article className="card suite-card" key={suite.id}>
                <div className="suite-card-top"><div className="suite-symbol"><Layers3 size={19} /></div><span className={suite.enabled ? 'status status-active' : 'status status-disabled'}>{suite.enabled ? 'Enabled' : 'Disabled'}</span></div>
                <div className="suite-module">{suite.module || 'General'}</div><h2>{suite.name}</h2><p>{suite.description || 'No description provided.'}</p>
                <div className="suite-card-stats"><span><TableProperties size={14} />{cases.filter(item => item.suiteId === suite.id).length} cases</span><span><Clock3 size={14} />{executions.filter(item => item.suiteId === suite.id).length} runs</span></div>
                <div className="suite-card-actions"><button className="button button-primary button-small" onClick={() => { setSelectedSuiteId(String(suite.id)); setPage('Test Execution'); }}><Play size={14} />Run suite</button><button className="icon-action" aria-label={`Edit ${suite.name}`} onClick={() => setSuiteDraft(suite)}><Pencil size={15} /></button><button className="icon-action danger-action" aria-label={`Delete ${suite.name}`} onClick={() => void deleteSuite(suite)}><Trash2 size={15} /></button></div>
              </article>)}</div> : <EmptyState icon={Layers3} title="No suites match" description={query ? 'Try another search term or clear the search.' : 'Create a suite to organize your test cases.'} action={!query ? <button className="button button-primary" onClick={() => setSuiteDraft({ name: '', description: '', module: '', enabled: true })}><Plus size={15} />Create first suite</button> : undefined} />}
            </>
          )}

          {!loading && page === 'Test Cases' && (
            <>
              <PageHeader kicker="TEST MANAGEMENT" title="Test cases" description="Write clear scenarios, define expected outcomes, and map each case to a suite." action={<button className="button button-primary" onClick={openNewCase}><Plus size={16} />New test case</button>} />
              <div className="toolbar"><div className="toolbar-copy"><BookOpenCheck size={16} /><strong>{filteredCases.length}</strong><span>of {cases.length} test cases</span></div><div className="toolbar-note"><Filter size={14} />Use search to filter by ID, name, or module</div></div>
              {filteredCases.length ? <div className="card table-card">
                <div className="table-scroll"><table className="data-table"><thead><tr><th>CASE</th><th>TEST CASE</th><th>SUITE / MODULE</th><th>PRIORITY</th><th>TYPE</th><th>AUTOMATION</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
                  {filteredCases.map(testCase => <tr key={testCase.id}>
                    <td><span className="case-id">{testCase.caseId}</span></td><td><strong className="table-primary">{testCase.name}</strong><span className="table-secondary">{testCase.description || 'No description'}</span></td>
                    <td><span className="table-primary">{suites.find(suite => suite.id === testCase.suiteId)?.name || 'Unassigned'}</span><span className="table-secondary">{testCase.module || 'General'}</span></td>
                    <td><Priority value={testCase.priority} /></td><td><span className="type-chip">{testCase.testType || 'Functional'}</span></td><td><span className={`automation-tag ${testCase.automationStatus?.toLowerCase() || 'manual'}`}>{testCase.automationStatus || 'MANUAL'}</span></td>
                    <td><div className="row-actions"><button className="icon-action" aria-label={`Edit ${testCase.caseId}`} onClick={() => setCaseDraft(testCase)}><Pencil size={15} /></button><button className="icon-action danger-action" aria-label={`Delete ${testCase.caseId}`} onClick={() => void deleteCase(testCase)}><Trash2 size={15} /></button></div></td>
                  </tr>)}
                </tbody></table></div>
              </div> : <EmptyState icon={TableProperties} title="No test cases found" description={query ? 'Try a different search or clear the search field.' : 'Add your first test case with steps and expected results.'} action={!query ? <button className="button button-primary" onClick={openNewCase}><Plus size={15} />Add a test case</button> : undefined} />}
            </>
          )}

          {!loading && page === 'Test Execution' && (
            <>
              <PageHeader kicker="RUN YOUR TESTS" title="Test execution" description="Choose a suite, run its cases, then save or inspect the results." />
              <div className="runner-notice"><Zap size={17} /><div><strong>Two ways to run tests</strong><span>Manual: check any saved case and mark it Pass, Fail, or Skip. Selenium: automatically checks TC_AUTH_001 (Valid login) in Chrome only.</span></div></div>
              <div className="execution-layout">
                <form className="card execution-form" onSubmit={event => void launchExecution(event)}>
                  <div className="section-kicker">NEW RUN</div><h2>Run configuration</h2><p>Choose how this run should execute.</p>
                  <Field label="Execution type"><select value={executionType} onChange={event => {
                    const nextType = event.target.value as 'MANUAL' | 'SELENIUM';
                    setExecutionType(nextType);
                    if (nextType === 'SELENIUM') {
                      const loginCase = cases.find(testCase => testCase.caseId === 'TC_AUTH_001');
                      if (loginCase?.suiteId) setSelectedSuiteId(String(loginCase.suiteId));
                    }
                  }}><option value="MANUAL">Manual case review</option><option value="SELENIUM">Selenium login check</option></select></Field>
                  <Field label="Test suite"><select value={selectedSuiteId} onChange={event => setSelectedSuiteId(event.target.value)}><option value="" disabled={executionType === 'SELENIUM'}>{executionType === 'SELENIUM' ? 'Select Authentication suite' : 'All suites / regression'}</option>{suites.filter(suite => executionType === 'MANUAL' || cases.some(testCase => testCase.caseId === 'TC_AUTH_001' && testCase.suiteId === suite.id)).map(suite => <option value={suite.id} key={suite.id}>{suite.name}</option>)}</select></Field>
                  <Field label="Environment"><select value={environment} onChange={event => setEnvironment(event.target.value)}><option>Development</option><option>Staging</option><option>Production</option></select></Field>
                  {executionType === 'MANUAL' ? <div className="manual-scope"><TableProperties size={15} /><span><strong>{cases.filter(testCase => !selectedSuiteId || testCase.suiteId === Number(selectedSuiteId)).length} cases</strong> will be included. Mark each result after review.</span></div> : <div className="manual-scope"><FlaskConical size={15} /><span><strong>Chrome / headless</strong> will run the saved TC_AUTH_001 login scenario.</span></div>}
                  {executionType === 'MANUAL' && <div className="form-grid-two"><Field label="Browser"><select value={selectedBrowser} onChange={event => setSelectedBrowser(event.target.value)}><option>Chrome</option><option>Firefox</option><option>Edge</option></select></Field><Field label="Run mode"><select value={executionMode} onChange={event => setExecutionMode(event.target.value)}><option>Headless</option><option>Headed</option></select></Field></div>}
                  <button className="button button-primary form-submit" type="submit"><Play size={15} fill="currentColor" />{executionType === 'MANUAL' ? 'Start manual run' : 'Run Selenium test'}</button>
                </form>
                <div className="card queue-card"><div className="section-heading"><div><div className="section-kicker">RUN HISTORY</div><h2>Your runs</h2><p>{executions.length} recorded run{executions.length === 1 ? '' : 's'} · queued means no final result yet</p></div><button className="icon-action" title="Refresh execution history" onClick={() => void refreshWorkspace()}><RefreshCw size={16} /></button></div>
                  {filteredExecutions.length ? <div className="queue-list">{filteredExecutions.slice(0, 10).map(execution => <button key={execution.id} className={`queue-item ${selectedExecution?.id === execution.id ? 'selected' : ''}`} onClick={() => selectExecution(execution)}>
                    <div className="queue-icon"><CirclePlay size={18} /></div><div className="queue-main"><strong>{execution.suiteName || 'Unnamed suite'}</strong><span>{runLabel(execution.id)} <i /> {dateLabel(execution.startedAt)}</span></div><Status value={execution.status} /><ArrowRight size={15} className="queue-arrow" />
                  </button>)}</div> : <EmptyState icon={CirclePlay} title="No matching runs" description="Queue an execution to see it here." compact />}
                </div>
              </div>
              {selectedExecution && <ExecutionDetail execution={selectedExecution} results={executionResults} cases={cases.filter(testCase => !selectedExecution.suiteId || testCase.suiteId === selectedExecution.suiteId)} onSaveManualResult={(testCase, status, note) => saveManualResult(selectedExecution, testCase, status, note)} onCancel={() => void cancelExecution(selectedExecution)} onReport={() => setPage('Test Reports')} />}
            </>
          )}

          {!loading && page === 'Test Reports' && (
            <>
              <PageHeader kicker="INSIGHTS" title="Test reports" description="Explore saved run summaries and review any recorded case-level results." action={<button className="button button-outline" onClick={() => void refreshWorkspace()}><RefreshCw size={15} />Refresh data</button>} />
              <section className="report-metrics"><Metric icon={CirclePlay} label="Total runs" value={executions.length} note="All recorded executions" color="blue" /><Metric icon={ShieldCheck} label="Passed" value={summary.passedTests} note="Checks marked passed" color="green" /><Metric icon={Activity} label="Failed" value={summary.failedTests} note="Checks marked failed" color="red" /><Metric icon={Gauge} label="Pass rate" value={`${summary.successRate}%`} note="Across recorded checks" color="amber" /></section>
              {filteredExecutions.length ? <div className="card table-card report-table"><div className="section-heading table-heading"><div><div className="section-kicker">EXECUTION HISTORY</div><h2>Run reports</h2><p>Select a run to inspect its recorded details.</p></div></div><ExecutionTable executions={filteredExecutions} selectedId={selectedExecution?.id} onSelect={execution => selectExecution(execution)} /></div> : <EmptyState icon={FileChartColumn} title="No reports yet" description="Execution reports appear here after runs have been recorded." action={<button className="button button-primary" onClick={() => setPage('Test Execution')}><Play size={15} />Go to execution</button>} />}
              {selectedExecution && <ExecutionDetail execution={selectedExecution} results={executionResults} cases={cases.filter(testCase => !selectedExecution.suiteId || testCase.suiteId === selectedExecution.suiteId)} onSaveManualResult={(testCase, status, note) => saveManualResult(selectedExecution, testCase, status, note)} onCancel={() => void cancelExecution(selectedExecution)} onExport={() => exportReport(selectedExecution)} />}
            </>
          )}

          {!loading && page === 'API Testing' && (
            <>
              <PageHeader kicker="DEVELOPER TOOLS" title="API checks" description="Run read-only checks against this workspace's own EnterpriseFlow API." />
              <div className="runner-notice safe-notice"><ShieldCheck size={17} /><div><strong>Workspace-scoped checks</strong><span>Requests are limited to read-only GET endpoints on the configured local API. Arbitrary URLs and write methods are disabled.</span></div></div>
              <div className="api-layout">
                <section className="card api-request-card"><div className="section-kicker">REQUEST BUILDER</div><h2>Choose an API check</h2><p>Run a safe health or workspace data check.</p><Field label="Endpoint"><select value={apiProbe} onChange={event => { setApiProbe(event.target.value); setProbeResult(null); }}><option value="/health">Service health</option><option value="/dashboard/summary">Dashboard summary</option><option value="/suites">Test suites</option><option value="/test-cases">Test cases</option><option value="/executions">Execution history</option></select></Field><div className="request-preview"><span className="method-chip">GET</span><code>{apiBaseUrl}{apiProbe}</code></div><button className="button button-primary form-submit" onClick={() => void runApiProbe()} disabled={probing}>{probing ? <LoaderCircle className="spin" size={15} /> : <Play size={15} />}Send request</button></section>
                <section className="card response-card"><div className="section-heading"><div><div className="section-kicker">RESPONSE</div><h2>Response preview</h2><p>HTTP status, elapsed time, and response body</p></div>{probeResult && <span className={`status ${probeResult.status < 400 ? 'status-active' : 'status-failed'}`}>{probeResult.status} {probeResult.status < 400 ? 'OK' : 'ERROR'}</span>}</div>{probeResult ? <><div className="response-meta"><span><Clock3 size={14} />{probeResult.elapsed} ms</span><span>application/json</span></div><pre className="response-body">{JSON.stringify(probeResult.data, null, 2)}</pre></> : <EmptyState icon={Code2} title="Ready when you are" description="Choose a check and send a request to preview its response." compact />}</section>
              </div>
            </>
          )}

          {!loading && page === 'Test Data' && (
            <>
              <PageHeader kicker="TEST FIXTURES" title="Test data" description="Manage sample employee records available to the EnterpriseFlow API." action={<button className="button button-primary" onClick={() => setEmployeeDraft({ employeeId: `EMP-${String(Date.now()).slice(-4)}`, firstName: '', lastName: '', email: '', phone: '', department: '', jobTitle: '', joiningDate: '', status: 'Active' })}><Plus size={16} />Add employee</button>} />
              <div className="runner-notice safe-notice"><Users size={17} /><div><strong>Sample employee dataset</strong><span>These records are stored in the backend and are separate from the sample HRMS web application.</span></div></div>
              {employees.length ? <div className="card table-card"><div className="table-scroll"><table className="data-table"><thead><tr><th>EMPLOYEE</th><th>EMPLOYEE ID</th><th>DEPARTMENT</th><th>JOB TITLE</th><th>EMAIL</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{employees.map(employee => <tr key={employee.id}><td><div className="employee-cell"><div className="avatar employee-avatar">{initials(employee.firstName || '?', employee.lastName || '')}</div><div><strong className="table-primary">{employee.firstName} {employee.lastName}</strong><span className="table-secondary">{employee.joiningDate || 'No joining date'}</span></div></div></td><td><span className="case-id">{employee.employeeId}</span></td><td>{employee.department || '-'}</td><td>{employee.jobTitle || '-'}</td><td>{employee.email}</td><td><span className={employee.status?.toLowerCase() === 'active' ? 'status status-active' : 'status status-disabled'}>{employee.status || 'Unknown'}</span></td><td><div className="row-actions"><button className="icon-action" aria-label={`Edit ${employee.firstName}`} onClick={() => setEmployeeDraft(employee)}><Pencil size={15} /></button><button className="icon-action danger-action" aria-label={`Delete ${employee.firstName}`} onClick={() => void deleteEmployee(employee)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div></div> : <EmptyState icon={Users} title="No sample employees" description="Add records to build a reusable sample dataset." action={<button className="button button-primary" onClick={() => setEmployeeDraft({ employeeId: `EMP-${String(Date.now()).slice(-4)}`, firstName: '', lastName: '', email: '', status: 'Active' })}><Plus size={15} />Add employee</button>} />}
            </>
          )}

          {!loading && page === 'Integrations' && (
            <>
              <PageHeader kicker="CONNECTED SERVICES" title="Integrations" description="Check the services that power your workspace and open their documentation." />
              <div className="integration-grid">
                <article className="card integration-card featured-integration"><div className="integration-icon"><ShieldCheck size={21} /></div><div className="integration-content"><div className="integration-title"><h2>EnterpriseFlow API</h2><span className={`status ${apiOnline ? 'status-active' : 'status-failed'}`}><i />{apiOnline ? 'Connected' : 'Unavailable'}</span></div><p>Workspace data, test management, and execution records.</p><div className="integration-endpoint"><span>BASE URL</span><code>{apiBaseUrl}</code></div><div className="integration-actions"><button className="button button-outline" onClick={() => void checkHealth()}><RefreshCw size={15} />Test connection</button><a className="button button-quiet" href={`${apiOrigin}/swagger-ui.html`} target="_blank" rel="noreferrer">Open API docs <ArrowRight size={14} /></a></div>{healthCheckedAt && <small className="checked-at">Last checked at {healthCheckedAt}</small>}</div></article>
                <article className="card integration-card"><div className="integration-icon icon-violet"><FlaskConical size={21} /></div><div className="integration-content"><div className="integration-title"><h2>Selenium runner</h2><span className="status status-active">Login check ready</span></div><p>Headless Chrome runs the existing valid-login scenario. Other saved test cases use the manual review workflow.</p><div className="integration-endpoint"><span>CHECK</span><code>TC_AUTH_001 - Valid login</code></div><div className="integration-actions"><button className="button button-outline" onClick={() => setPage('Test Execution')}>Configure a test run <ArrowRight size={14} /></button></div></div></article>
                <article className="card integration-card"><div className="integration-icon icon-blue"><Layers3 size={21} /></div><div className="integration-content"><div className="integration-title"><h2>Database</h2><span className="status status-active">Managed by API</span></div><p>Development uses the backend's configured database profile. Data changes are saved through the REST API.</p><div className="integration-endpoint"><span>DATA SCOPE</span><code>Suites, cases, runs, employees</code></div><div className="integration-actions"><button className="button button-quiet" onClick={() => setPage('Settings')}>Workspace settings <ArrowRight size={14} /></button></div></div></article>
              </div>
            </>
          )}

          {!loading && page === 'Settings' && (
            <>
              <PageHeader kicker="WORKSPACE PREFERENCES" title="Settings" description="Choose local workspace defaults for this browser." />
              <div className="settings-layout">
                <section className="card settings-card"><div className="settings-title"><div className="settings-icon"><Settings size={19} /></div><div><h2>Workspace preferences</h2><p>These preferences are saved in this browser.</p></div></div><div className="setting-row"><div><strong>Default environment</strong><span>Used when creating a new execution.</span></div><select value={environment} onChange={event => setEnvironment(event.target.value)}><option>Development</option><option>Staging</option><option>Production</option></select></div><div className="setting-row"><div><strong>Color theme</strong><span>Choose a comfortable workspace appearance.</span></div><button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><Moon size={15} />{theme === 'light' ? 'Switch to dark' : 'Switch to light'}</button></div><div className="setting-row"><div><strong>API connection</strong><span>Workspace API endpoint used by the dashboard.</span></div><code className="setting-value">{apiBaseUrl}</code></div><div className="setting-actions"><button className="button button-outline" onClick={() => void checkHealth()}><Activity size={15} />Check API connection</button><button className="button button-primary" onClick={() => notify('Your preferences are saved in this browser.')}>Save preferences <Check size={15} /></button></div></section>
                <aside className="card about-card"><div className="brand-mark"><ShieldCheck size={20} /></div><h2>EnterpriseFlow</h2><p>Quality engineering workspace</p><div className="about-divider" /><div><span>Version</span><strong>1.0.0</strong></div><div><span>API</span><strong className={apiOnline ? 'text-green' : 'text-red'}>{apiOnline ? 'Online' : 'Offline'}</strong></div><div><span>Test cases</span><strong>{cases.length}</strong></div><div><span>Test suites</span><strong>{suites.length}</strong></div></aside>
              </div>
            </>
          )}
        </div>
      </main>

      {suiteDraft && <Modal title={suiteDraft.id ? 'Edit test suite' : 'Create test suite'} subtitle="Keep related scenarios grouped and easy to run." onClose={() => setSuiteDraft(null)}><form className="modal-form" onSubmit={event => void saveSuite(event)}><Field label="Suite name" required><input autoFocus required value={suiteDraft.name || ''} onChange={event => setSuiteDraft({ ...suiteDraft, name: event.target.value })} placeholder="e.g. Authentication smoke tests" /></Field><Field label="Module"><input value={suiteDraft.module || ''} onChange={event => setSuiteDraft({ ...suiteDraft, module: event.target.value })} placeholder="e.g. Authentication" /></Field><Field label="Description"><textarea rows={3} value={suiteDraft.description || ''} onChange={event => setSuiteDraft({ ...suiteDraft, description: event.target.value })} placeholder="What does this suite cover?" /></Field><label className="checkbox-field"><input type="checkbox" checked={suiteDraft.enabled ?? true} onChange={event => setSuiteDraft({ ...suiteDraft, enabled: event.target.checked })} />Suite is enabled</label><ModalActions onCancel={() => setSuiteDraft(null)} submitLabel={suiteDraft.id ? 'Save changes' : 'Create suite'} /></form></Modal>}

      {caseDraft && <Modal title={caseDraft.id ? 'Edit test case' : 'Create test case'} subtitle="Document a repeatable scenario and its expected outcome." onClose={() => setCaseDraft(null)} wide><form className="modal-form" onSubmit={event => void saveCase(event)}><div className="form-grid-two"><Field label="Case ID" required><input required value={caseDraft.caseId || ''} onChange={event => setCaseDraft({ ...caseDraft, caseId: event.target.value })} placeholder="TC-001" /></Field><Field label="Test case name" required><input autoFocus required value={caseDraft.name || ''} onChange={event => setCaseDraft({ ...caseDraft, name: event.target.value })} placeholder="e.g. User can sign in" /></Field></div><div className="form-grid-two"><Field label="Suite"><select value={caseDraft.suiteId || ''} onChange={event => setCaseDraft({ ...caseDraft, suiteId: event.target.value ? Number(event.target.value) : null })}><option value="">Unassigned</option>{suites.map(suite => <option key={suite.id} value={suite.id}>{suite.name}</option>)}</select></Field><Field label="Module"><input value={caseDraft.module || ''} onChange={event => setCaseDraft({ ...caseDraft, module: event.target.value })} placeholder="e.g. Authentication" /></Field></div><div className="form-grid-three"><Field label="Priority"><select value={caseDraft.priority || 'Medium'} onChange={event => setCaseDraft({ ...caseDraft, priority: event.target.value })}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></Field><Field label="Type"><select value={caseDraft.testType || 'Functional'} onChange={event => setCaseDraft({ ...caseDraft, testType: event.target.value })}><option>Functional</option><option>Regression</option><option>Smoke</option><option>Integration</option><option>API</option></select></Field><Field label="Automation status"><select value={caseDraft.automationStatus || 'MANUAL'} onChange={event => setCaseDraft({ ...caseDraft, automationStatus: event.target.value })}><option value="MANUAL">Manual</option><option value="AUTOMATED">Automated</option><option value="NOT_AUTOMATED">Not automated</option></select></Field></div><Field label="Description"><textarea rows={2} value={caseDraft.description || ''} onChange={event => setCaseDraft({ ...caseDraft, description: event.target.value })} placeholder="Purpose of this test case" /></Field><div className="form-grid-two"><Field label="Preconditions"><textarea rows={3} value={caseDraft.preconditions || ''} onChange={event => setCaseDraft({ ...caseDraft, preconditions: event.target.value })} placeholder="State needed before the test" /></Field><Field label="Test steps"><textarea rows={3} value={caseDraft.testSteps || ''} onChange={event => setCaseDraft({ ...caseDraft, testSteps: event.target.value })} placeholder="One step per line" /></Field></div><Field label="Expected result"><textarea rows={2} value={caseDraft.expectedResult || ''} onChange={event => setCaseDraft({ ...caseDraft, expectedResult: event.target.value })} placeholder="What should happen?" /></Field><ModalActions onCancel={() => setCaseDraft(null)} submitLabel={caseDraft.id ? 'Save changes' : 'Create test case'} /></form></Modal>}

      {employeeDraft && <Modal title={employeeDraft.id ? 'Edit test data' : 'Add sample employee'} subtitle="Create an employee record for workspace test data." onClose={() => setEmployeeDraft(null)} wide><form className="modal-form" onSubmit={event => void saveEmployee(event)}><div className="form-grid-two"><Field label="Employee ID" required><input required value={employeeDraft.employeeId || ''} onChange={event => setEmployeeDraft({ ...employeeDraft, employeeId: event.target.value })} placeholder="EMP-003" /></Field><Field label="Email" required><input type="email" required value={employeeDraft.email || ''} onChange={event => setEmployeeDraft({ ...employeeDraft, email: event.target.value })} placeholder="person@example.com" /></Field></div><div className="form-grid-two"><Field label="First name" required><input required value={employeeDraft.firstName || ''} onChange={event => setEmployeeDraft({ ...employeeDraft, firstName: event.target.value })} /></Field><Field label="Last name"><input value={employeeDraft.lastName || ''} onChange={event => setEmployeeDraft({ ...employeeDraft, lastName: event.target.value })} /></Field></div><div className="form-grid-two"><Field label="Department"><input value={employeeDraft.department || ''} onChange={event => setEmployeeDraft({ ...employeeDraft, department: event.target.value })} /></Field><Field label="Job title"><input value={employeeDraft.jobTitle || ''} onChange={event => setEmployeeDraft({ ...employeeDraft, jobTitle: event.target.value })} /></Field></div><div className="form-grid-three"><Field label="Phone"><input value={employeeDraft.phone || ''} onChange={event => setEmployeeDraft({ ...employeeDraft, phone: event.target.value })} /></Field><Field label="Joining date"><input type="date" value={employeeDraft.joiningDate || ''} onChange={event => setEmployeeDraft({ ...employeeDraft, joiningDate: event.target.value })} /></Field><Field label="Status"><select value={employeeDraft.status || 'Active'} onChange={event => setEmployeeDraft({ ...employeeDraft, status: event.target.value })}><option>Active</option><option>Inactive</option><option>On Leave</option></select></Field></div><ModalActions onCancel={() => setEmployeeDraft(null)} submitLabel={employeeDraft.id ? 'Save changes' : 'Add employee'} /></form></Modal>}
    </div>
  );
}

function Metric({ icon: Icon, label, value, note, color }: { icon: typeof Gauge; label: string; value: string | number; note: string; color: string }) {
  return <article className={`metric-card metric-${color}`}><div className="metric-top"><span>{label}</span><div className="metric-icon"><Icon size={17} /></div></div><strong>{value}</strong><small>{note}</small></article>;
}

function PageHeader({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><div className="section-kicker">{kicker}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-header-action">{action}</div>}</div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="field"><span>{label}{required && <i> *</i>}</span>{children}</label>;
}

function Status({ value }: { value: string }) {
  return <span className={statusClass(value)}><i />{value.replace(/_/g, ' ')}</span>;
}

function Priority({ value }: { value: string }) {
  return <span className={`priority priority-${(value || 'medium').toLowerCase()}`}><i />{value || 'Medium'}</span>;
}

function ExecutionTable({ executions, selectedId, onSelect }: { executions: Execution[]; selectedId?: number; onSelect: (execution: Execution) => void }) {
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>RUN</th><th>SUITE</th><th>ENVIRONMENT</th><th>STARTED</th><th>RESULTS</th><th>STATUS</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{executions.map(execution => <tr key={execution.id} className={selectedId === execution.id ? 'row-selected' : ''}><td><span className="case-id">{runLabel(execution.id)}</span></td><td><strong className="table-primary">{execution.suiteName || 'Unnamed suite'}</strong><span className="table-secondary">{execution.browser || 'Browser not set'} / {executionModeLabel(execution.mode || 'Unknown')}</span></td><td>{execution.environment || '-'}</td><td>{dateLabel(execution.startedAt)}</td><td><span className="result-counts"><b className="text-green">{execution.passedTests} passed</b><b className="text-red">{execution.failedTests} failed</b><span>{execution.totalTests} total</span></span></td><td><Status value={execution.status || 'UNKNOWN'} /></td><td><button className="text-button" onClick={() => onSelect(execution)}>Details <ArrowRight size={13} /></button></td></tr>)}</tbody></table></div>;
}

function ExecutionDetail({ execution, results, cases, onSaveManualResult, onCancel, onReport, onExport }: {
  execution: Execution;
  results: TestResult[];
  cases: TestCase[];
  onSaveManualResult?: (testCase: TestCase, status: string, note: string) => Promise<boolean>;
  onCancel?: () => void;
  onReport?: () => void;
  onExport?: () => void;
}) {
  const canCancel = execution.status === 'QUEUED' || (execution.status === 'RUNNING' && execution.mode === 'MANUAL');
  const resultCount = results.length;
  const progress = execution.totalTests ? Math.min(100, Math.round((resultCount / execution.totalTests) * 100)) : 0;
  return <section className="card execution-detail"><div className="section-heading"><div><div className="section-kicker">RUN DETAILS</div><h2>{execution.suiteName || 'Unnamed suite'} <span className="detail-run-id">{runLabel(execution.id)}</span></h2><p>{execution.environment} / {execution.browser} / {executionModeLabel(execution.mode)} <i /> Started {dateLabel(execution.startedAt)}</p></div><div className="detail-actions"><Status value={execution.status || 'UNKNOWN'} />{canCancel && onCancel && <button className="button button-danger" onClick={onCancel}><X size={14} />Cancel run</button>}{onExport && <button className="button button-outline" onClick={onExport}><ArrowDownToLine size={14} />Export CSV</button>}{onReport && <button className="button button-outline" onClick={onReport}>Full report <ArrowRight size={14} /></button>}</div></div>
    <div className="detail-stats"><div><span>Total cases</span><strong>{execution.totalTests}</strong></div><div><span>Passed</span><strong className="text-green">{execution.passedTests}</strong></div><div><span>Failed</span><strong className="text-red">{execution.failedTests}</strong></div><div><span>Skipped</span><strong>{execution.skippedTests}</strong></div><div><span>Duration</span><strong>{durationLabel(execution.durationMs || 0)}</strong></div></div>
    {execution.mode === 'MANUAL' && execution.status === 'RUNNING' && onSaveManualResult && <ManualChecklist cases={cases} results={results} onSave={onSaveManualResult} />}
    {execution.mode !== 'MANUAL' && execution.status === 'RUNNING' && <div className="selenium-progress"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span>Selenium is checking the HRMS login flow. This panel refreshes automatically.</span></div>}
    {results.length ? <div className="result-list"><h3>Recorded test results</h3>{results.map(result => <div className="result-row" key={result.id}><Status value={result.status || 'UNKNOWN'} /><div><strong>{result.testName || result.caseId || 'Unnamed test'}</strong><span>{result.module || 'General'}{result.errorMessage ? ` - ${result.errorMessage}` : ''}</span>{result.logs && <span className="result-logs">{result.logs}</span>}</div><small>{durationLabel(result.durationMs || 0)}</small>{result.screenshotPath && <a className="button button-outline button-small result-screenshot" href={`${apiBaseUrl}/executions/${execution.id}/results/${result.id}/screenshot`} target="_blank" rel="noreferrer">View screenshot</a>}</div>)}</div> : execution.status !== 'RUNNING' && <div className="detail-empty"><CircleHelp size={16} /><span>{execution.status === 'QUEUED' ? 'Waiting for the runner to start.' : 'No case-level results were saved for this run.'}</span></div>}
  </section>;
}

function ManualChecklist({ cases, results, onSave }: {
  cases: TestCase[];
  results: TestResult[];
  onSave: (testCase: TestCase, status: string, note: string) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState<Record<string, { status: string; note: string }>>({});
  const [savingId, setSavingId] = useState('');
  const recorded = new Set(results.map(result => result.caseId));
  return <div className="manual-checklist">
    <div className="manual-checklist-heading"><div><h3>Case-by-case review</h3><span>{recorded.size} of {cases.length} results saved</span></div><div className="progress-track"><span style={{ width: `${cases.length ? Math.round((recorded.size / cases.length) * 100) : 0}%` }} /></div></div>
    {cases.map(testCase => {
      const saved = recorded.has(testCase.caseId);
      const draft = drafts[testCase.caseId] || { status: '', note: '' };
      return <div className={`manual-case ${saved ? 'is-recorded' : ''}`} key={testCase.id}>
        <div className="manual-case-title"><span className="case-id">{testCase.caseId}</span><strong>{testCase.name}</strong><small>{testCase.module || 'General'} / {testCase.priority || 'Medium'} priority</small></div>
        <div className="manual-case-expected"><span>EXPECTED</span>{testCase.expectedResult || testCase.description || 'No expected result documented.'}</div>
        {saved ? <span className="manual-saved"><Check size={14} />Result saved</span> : <div className="manual-case-controls">
          <select aria-label={`Result for ${testCase.caseId}`} value={draft.status} onChange={event => setDrafts(current => ({ ...current, [testCase.caseId]: { ...draft, status: event.target.value } }))}><option value="">Choose result</option><option value="PASSED">Passed</option><option value="FAILED">Failed</option><option value="SKIPPED">Skipped</option></select>
          <input aria-label={`Notes for ${testCase.caseId}`} value={draft.note} onChange={event => setDrafts(current => ({ ...current, [testCase.caseId]: { ...draft, note: event.target.value } }))} placeholder="Optional notes / failure details" />
          <button className="button button-outline button-small" disabled={!draft.status || savingId === testCase.caseId} onClick={async () => {
            setSavingId(testCase.caseId);
            try {
              const savedResult = await onSave(testCase, draft.status, draft.note);
              if (savedResult) setDrafts(current => ({ ...current, [testCase.caseId]: { status: '', note: '' } }));
            } finally {
              setSavingId('');
            }
          }}>{savingId === testCase.caseId ? <LoaderCircle className="spin" size={13} /> : <Check size={13} />}Save result</button>
        </div>}
      </div>;
    })}
    {cases.length === 0 && <div className="detail-empty"><CircleHelp size={16} /><span>This suite has no cases to review.</span></div>}
  </div>;
}

function EmptyState({ icon: Icon, title, description, action, compact }: { icon: typeof Gauge; title: string; description: string; action?: React.ReactNode; compact?: boolean }) {
  return <div className={`empty-state ${compact ? 'empty-compact' : ''}`}><div className="empty-icon"><Icon size={20} /></div><strong>{title}</strong><p>{description}</p>{action}</div>;
}

function Modal({ title, subtitle, children, onClose, wide }: { title: string; subtitle: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-action" onClick={onClose} aria-label="Close dialog"><X size={17} /></button></div>{children}</section></div>;
}

function ModalActions({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return <div className="modal-actions"><button type="button" className="button button-outline" onClick={onCancel}>Cancel</button><button type="submit" className="button button-primary">{submitLabel}<ArrowRight size={14} /></button></div>;
}

export default App;
