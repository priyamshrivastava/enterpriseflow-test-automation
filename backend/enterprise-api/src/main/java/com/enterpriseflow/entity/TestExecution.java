package com.enterpriseflow.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="test_executions")
public class TestExecution {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="suite_id") private Long suiteId;
    @Column(name="suite_name") private String suiteName;
    private String environment; private String browser; private String mode;
    private String status="QUEUED";
    @Column(name="total_tests") private int totalTests;
    @Column(name="passed_tests") private int passedTests;
    @Column(name="failed_tests") private int failedTests;
    @Column(name="skipped_tests") private int skippedTests;
    @Column(name="current_test") private String currentTest;
    @Column(name="started_at") private Instant startedAt;
    @Column(name="finished_at") private Instant finishedAt;
    @Column(name="duration_ms") private long durationMs;
    public Long getId(){return id;} public void setId(Long id){this.id=id;}
    public Long getSuiteId(){return suiteId;} public void setSuiteId(Long suiteId){this.suiteId=suiteId;}
    public String getSuiteName(){return suiteName;} public void setSuiteName(String suiteName){this.suiteName=suiteName;}
    public String getEnvironment(){return environment;} public void setEnvironment(String environment){this.environment=environment;}
    public String getBrowser(){return browser;} public void setBrowser(String browser){this.browser=browser;}
    public String getMode(){return mode;} public void setMode(String mode){this.mode=mode;}
    public String getStatus(){return status;} public void setStatus(String status){this.status=status;}
    public int getTotalTests(){return totalTests;} public void setTotalTests(int totalTests){this.totalTests=totalTests;}
    public int getPassedTests(){return passedTests;} public void setPassedTests(int passedTests){this.passedTests=passedTests;}
    public int getFailedTests(){return failedTests;} public void setFailedTests(int failedTests){this.failedTests=failedTests;}
    public int getSkippedTests(){return skippedTests;} public void setSkippedTests(int skippedTests){this.skippedTests=skippedTests;}
    public String getCurrentTest(){return currentTest;} public void setCurrentTest(String currentTest){this.currentTest=currentTest;}
    public Instant getStartedAt(){return startedAt;} public void setStartedAt(Instant startedAt){this.startedAt=startedAt;}
    public Instant getFinishedAt(){return finishedAt;} public void setFinishedAt(Instant finishedAt){this.finishedAt=finishedAt;}
    public long getDurationMs(){return durationMs;} public void setDurationMs(long durationMs){this.durationMs=durationMs;}
}
