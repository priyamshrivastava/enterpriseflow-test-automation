package com.enterpriseflow.entity;

import jakarta.persistence.*;

@Entity @Table(name="test_cases")
public class TestCase {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="case_id",unique=true,nullable=false) private String caseId;
    private String name; private String module; private String description;
    private String preconditions; @Column(name="test_steps") private String testSteps;
    @Column(name="expected_result") private String expectedResult;
    private String priority; @Column(name="test_type") private String testType;
    @Column(name="automation_status") private String automationStatus;
    @Column(name="suite_id") private Long suiteId;

    public Long getId(){return id;} public void setId(Long id){this.id=id;}
    public String getCaseId(){return caseId;} public void setCaseId(String caseId){this.caseId=caseId;}
    public String getName(){return name;} public void setName(String name){this.name=name;}
    public String getModule(){return module;} public void setModule(String module){this.module=module;}
    public String getDescription(){return description;} public void setDescription(String description){this.description=description;}
    public String getPreconditions(){return preconditions;} public void setPreconditions(String preconditions){this.preconditions=preconditions;}
    public String getTestSteps(){return testSteps;} public void setTestSteps(String testSteps){this.testSteps=testSteps;}
    public String getExpectedResult(){return expectedResult;} public void setExpectedResult(String expectedResult){this.expectedResult=expectedResult;}
    public String getPriority(){return priority;} public void setPriority(String priority){this.priority=priority;}
    public String getTestType(){return testType;} public void setTestType(String testType){this.testType=testType;}
    public String getAutomationStatus(){return automationStatus;} public void setAutomationStatus(String automationStatus){this.automationStatus=automationStatus;}
    public Long getSuiteId(){return suiteId;} public void setSuiteId(Long suiteId){this.suiteId=suiteId;}
}
