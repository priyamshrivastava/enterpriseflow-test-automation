package com.enterpriseflow.entity;

import jakarta.persistence.*;

@Entity @Table(name="test_results")
public class TestResult {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="execution_id") private Long executionId;
    @Column(name="case_id") private String caseId;
    @Column(name="test_name") private String testName;
    private String module; private String status;
    @Column(name="duration_ms") private long durationMs;
    @Column(name="error_message") private String errorMessage;
    @Column(name="screenshot_path") private String screenshotPath;
    private String logs;
    public Long getId(){return id;} public void setId(Long id){this.id=id;}
    public Long getExecutionId(){return executionId;} public void setExecutionId(Long executionId){this.executionId=executionId;}
    public String getCaseId(){return caseId;} public void setCaseId(String caseId){this.caseId=caseId;}
    public String getTestName(){return testName;} public void setTestName(String testName){this.testName=testName;}
    public String getModule(){return module;} public void setModule(String module){this.module=module;}
    public String getStatus(){return status;} public void setStatus(String status){this.status=status;}
    public long getDurationMs(){return durationMs;} public void setDurationMs(long durationMs){this.durationMs=durationMs;}
    public String getErrorMessage(){return errorMessage;} public void setErrorMessage(String errorMessage){this.errorMessage=errorMessage;}
    public String getScreenshotPath(){return screenshotPath;} public void setScreenshotPath(String screenshotPath){this.screenshotPath=screenshotPath;}
    public String getLogs(){return logs;} public void setLogs(String logs){this.logs=logs;}
}
