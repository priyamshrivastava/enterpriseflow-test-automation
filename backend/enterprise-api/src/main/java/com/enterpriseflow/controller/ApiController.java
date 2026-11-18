package com.enterpriseflow.controller;

import com.enterpriseflow.entity.*;
import com.enterpriseflow.repository.*;
import com.enterpriseflow.service.SeleniumLoginRunner;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.time.Instant;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final TestSuiteRepository suites;
    private final TestCaseRepository cases;
    private final TestExecutionRepository executions;
    private final TestResultRepository results;
    private final EmployeeRepository employees;
    private final SeleniumLoginRunner seleniumLoginRunner;
    private final Path storageDirectory;

    public ApiController(
        TestSuiteRepository suites,
        TestCaseRepository cases,
        TestExecutionRepository executions,
        TestResultRepository results,
        EmployeeRepository employees,
        SeleniumLoginRunner seleniumLoginRunner,
        @Value("${enterpriseflow.storage:./storage}") String storageDirectory
    ) {
        this.suites=suites; this.cases=cases; this.executions=executions; this.results=results; this.employees=employees; this.seleniumLoginRunner=seleniumLoginRunner;
        this.storageDirectory=Path.of(storageDirectory).toAbsolutePath().normalize();
    }

    @GetMapping("/health") public Map<String,Object> health(){return Map.of("status","UP","service","EnterpriseFlow API");}

    @GetMapping("/dashboard/summary")
    public Map<String,Object> summary(){
        List<TestExecution> runs=executions.findAll();
        int passed=runs.stream().mapToInt(TestExecution::getPassedTests).sum();
        int failed=runs.stream().mapToInt(TestExecution::getFailedTests).sum();
        int totalCases=cases.findAll().size();
        int success=passed+failed==0 ? 0 : Math.round(passed*100f/(passed+failed));
        long avg=runs.isEmpty()?0:runs.stream().mapToLong(TestExecution::getDurationMs).sum()/runs.size();
        return Map.of("totalTestCases",totalCases,"passedTests",passed,"failedTests",failed,
          "successRate",success,"averageExecutionTimeMs",avg,"activeSuites",suites.findAll().stream().filter(TestSuite::isEnabled).count(),
          "totalExecutions",runs.size());
    }

    @GetMapping("/dashboard/trends")
    public List<Map<String,Object>> trends(){ return Collections.emptyList(); }

    @GetMapping("/dashboard/module-performance")
    public List<Map<String,Object>> modulePerformance(){
        return List.of(Map.of("module","Authentication","passed",0,"failed",0),
          Map.of("module","Employee Management","passed",0,"failed",0),
          Map.of("module","Leave Management","passed",0,"failed",0),
          Map.of("module","Recruitment","passed",0,"failed",0),
          Map.of("module","Admin","passed",0,"failed",0));
    }

    @GetMapping("/dashboard/activity")
    public List<Map<String,Object>> activity(){ return Collections.emptyList(); }

    @GetMapping("/suites") public List<TestSuite> getSuites(){return suites.findAll();}
    @GetMapping("/suites/{id}") public ResponseEntity<TestSuite> getSuite(@PathVariable Long id){return suites.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());}
    @PostMapping("/suites") public TestSuite createSuite(@RequestBody TestSuite suite){return suites.save(suite);}
    @PutMapping("/suites/{id}") public ResponseEntity<TestSuite> updateSuite(@PathVariable Long id,@RequestBody TestSuite suite){
        return suites.findById(id).map(existing->{suite.setId(id);return ResponseEntity.ok(suites.save(suite));}).orElse(ResponseEntity.notFound().build());
    }
    @DeleteMapping("/suites/{id}") public ResponseEntity<Void> deleteSuite(@PathVariable Long id){if(!suites.existsById(id))return ResponseEntity.notFound().build();suites.deleteById(id);return ResponseEntity.noContent().build();}

    @GetMapping("/test-cases") public List<TestCase> getCases(){return cases.findAll();}
    @PostMapping("/test-cases") public TestCase createCase(@RequestBody TestCase testCase){return cases.save(testCase);}
    @PutMapping("/test-cases/{id}") public ResponseEntity<TestCase> updateCase(@PathVariable Long id,@RequestBody TestCase testCase){return cases.findById(id).map(existing->{testCase.setId(id);return ResponseEntity.ok(cases.save(testCase));}).orElse(ResponseEntity.notFound().build());}
    @DeleteMapping("/test-cases/{id}") public ResponseEntity<Void> deleteCase(@PathVariable Long id){if(!cases.existsById(id))return ResponseEntity.notFound().build();cases.deleteById(id);return ResponseEntity.noContent().build();}

    @GetMapping("/executions") public List<TestExecution> getExecutions(){return executions.findAll();}
    @GetMapping("/executions/{id}") public ResponseEntity<TestExecution> getExecution(@PathVariable Long id){return executions.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());}
    @PostMapping("/executions") public TestExecution createExecution(@RequestBody Map<String,Object> request){
        TestExecution execution=new TestExecution();
        if(request.get("suiteId")!=null)execution.setSuiteId(Long.valueOf(request.get("suiteId").toString()));
        execution.setSuiteName(request.getOrDefault("suiteName","Demo Suite").toString());
        execution.setEnvironment(request.getOrDefault("environment","Development").toString());
        execution.setBrowser(request.getOrDefault("browser","Chrome").toString());
        execution.setMode(request.getOrDefault("mode","Headless").toString());
        execution.setStatus("QUEUED");execution.setStartedAt(java.time.Instant.now());
        return executions.save(execution);
    }
    @PutMapping("/executions/{id}") public ResponseEntity<TestExecution> updateExecution(@PathVariable Long id,@RequestBody TestExecution update){
        return executions.findById(id).map(existing->{update.setId(id);return ResponseEntity.ok(executions.save(update));}).orElse(ResponseEntity.notFound().build());
    }
    @PostMapping("/executions/{id}/run-selenium")
    public ResponseEntity<?> runSelenium(@PathVariable Long id) {
        TestExecution execution=executions.findById(id).orElse(null);
        if(execution==null)return ResponseEntity.notFound().build();
        if(!"QUEUED".equals(execution.getStatus()))return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message","Only queued executions can be started."));
        Optional<TestCase> loginCase=cases.findByCaseId("TC_AUTH_001");
        if(execution.getSuiteId()==null||loginCase.isEmpty()||!Objects.equals(loginCase.get().getSuiteId(),execution.getSuiteId()))
            return ResponseEntity.badRequest().body(Map.of("message","The existing Selenium check only covers TC_AUTH_001 in its assigned suite."));
        if(!"Chrome".equalsIgnoreCase(execution.getBrowser()))
            return ResponseEntity.badRequest().body(Map.of("message","The existing Selenium check currently supports Chrome only."));
        execution.setTotalTests(1);
        execution.setCurrentTest("TC_AUTH_001 - Valid login");
        execution=executions.save(execution);
        if(!seleniumLoginRunner.submit(id)) {
            Instant finished=Instant.now();
            execution.setStatus("FAILED");
            execution.setFailedTests(1);
            execution.setFinishedAt(finished);
            execution.setCurrentTest(null);
            TestResult result=new TestResult();
            result.setExecutionId(id);
            result.setCaseId("TC_AUTH_001");
            result.setTestName("Valid login");
            result.setModule("Authentication");
            result.setStatus("FAILED");
            result.setErrorMessage("The Selenium runner is busy. Try again after the active run finishes.");
            results.save(result);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(executions.save(execution));
        }
        return ResponseEntity.accepted().body(execution);
    }
    @PostMapping("/executions/{id}/cancel") public ResponseEntity<TestExecution> cancel(@PathVariable Long id){
        return executions.findById(id).map(existing->{existing.setStatus("CANCELLED");existing.setFinishedAt(java.time.Instant.now());return ResponseEntity.ok(executions.save(existing));}).orElse(ResponseEntity.notFound().build());
    }
    @GetMapping("/executions/{id}/results") public List<TestResult> executionResults(@PathVariable Long id){return results.findAllByExecutionId(id);}
    @GetMapping(value="/executions/{executionId}/results/{resultId}/screenshot",produces=MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<Resource> executionResultScreenshot(@PathVariable Long executionId,@PathVariable Long resultId) {
        TestResult result=results.findById(resultId).filter(item->Objects.equals(item.getExecutionId(),executionId)).orElse(null);
        if(result==null||result.getScreenshotPath()==null||result.getScreenshotPath().isBlank())return ResponseEntity.notFound().build();
        Path screenshot=storageDirectory.resolve(result.getScreenshotPath()).normalize();
        if(!screenshot.startsWith(storageDirectory)||!Files.isRegularFile(screenshot))return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(new FileSystemResource(screenshot));
    }
    @PostMapping("/executions/{id}/results")
    public ResponseEntity<TestResult> addResult(@PathVariable Long id,@RequestBody TestResult result) {
        TestExecution execution=executions.findById(id).orElse(null);
        if(execution==null)return ResponseEntity.notFound().build();
        if(result.getStatus()==null||!Set.of("PASSED","FAILED","SKIPPED").contains(result.getStatus()))
            return ResponseEntity.badRequest().build();
        result.setExecutionId(id);
        TestResult saved=results.save(result);
        List<TestResult> recorded=results.findAllByExecutionId(id);
        int passed=(int)recorded.stream().filter(item->"PASSED".equals(item.getStatus())).count();
        int failed=(int)recorded.stream().filter(item->"FAILED".equals(item.getStatus())).count();
        int skipped=(int)recorded.stream().filter(item->"SKIPPED".equals(item.getStatus())).count();
        execution.setTotalTests(Math.max(execution.getTotalTests(),recorded.size()));
        execution.setPassedTests(passed);
        execution.setFailedTests(failed);
        execution.setSkippedTests(skipped);
        if(execution.getTotalTests()>0&&recorded.size()>=execution.getTotalTests()) {
            execution.setStatus(failed>0?"FAILED":"COMPLETED");
            execution.setFinishedAt(Instant.now());
            if(execution.getStartedAt()!=null)execution.setDurationMs(Duration.between(execution.getStartedAt(),execution.getFinishedAt()).toMillis());
            execution.setCurrentTest(null);
        } else {
            execution.setStatus("RUNNING");
        }
        executions.save(execution);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/reports") public List<TestExecution> reports(){return executions.findAll();}
    @GetMapping("/reports/{id}") public ResponseEntity<Map<String,Object>> report(@PathVariable Long id){
        return executions.findById(id).map(e->ResponseEntity.ok((Map<String,Object>)new HashMap<>(Map.of("execution",e,"results",executionResults(id))))).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/employees") public List<Employee> employees(){return employees.findAll();}
    @PostMapping("/employees") public Employee createEmployee(@RequestBody Employee employee){return employees.save(employee);}
    @PutMapping("/employees/{id}") public ResponseEntity<Employee> updateEmployee(@PathVariable Long id,@RequestBody Employee employee){return employees.findById(id).map(existing->{employee.setId(id);return ResponseEntity.ok(employees.save(employee));}).orElse(ResponseEntity.notFound().build());}
    @DeleteMapping("/employees/{id}") public ResponseEntity<Void> deleteEmployee(@PathVariable Long id){if(!employees.existsById(id))return ResponseEntity.notFound().build();employees.deleteById(id);return ResponseEntity.noContent().build();}
}
