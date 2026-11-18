package com.enterpriseflow.entity;
import jakarta.persistence.*;
import java.time.LocalDate;

@Entity @Table(name="employees")
public class Employee {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="employee_id",unique=true) private String employeeId;
    @Column(name="first_name") private String firstName;
    @Column(name="last_name") private String lastName;
    private String email; private String phone; private String department;
    @Column(name="job_title") private String jobTitle;
    @Column(name="joining_date") private LocalDate joiningDate;
    private String status;
    public Long getId(){return id;} public void setId(Long id){this.id=id;}
    public String getEmployeeId(){return employeeId;} public void setEmployeeId(String employeeId){this.employeeId=employeeId;}
    public String getFirstName(){return firstName;} public void setFirstName(String firstName){this.firstName=firstName;}
    public String getLastName(){return lastName;} public void setLastName(String lastName){this.lastName=lastName;}
    public String getEmail(){return email;} public void setEmail(String email){this.email=email;}
    public String getPhone(){return phone;} public void setPhone(String phone){this.phone=phone;}
    public String getDepartment(){return department;} public void setDepartment(String department){this.department=department;}
    public String getJobTitle(){return jobTitle;} public void setJobTitle(String jobTitle){this.jobTitle=jobTitle;}
    public LocalDate getJoiningDate(){return joiningDate;} public void setJoiningDate(LocalDate joiningDate){this.joiningDate=joiningDate;}
    public String getStatus(){return status;} public void setStatus(String status){this.status=status;}
}
