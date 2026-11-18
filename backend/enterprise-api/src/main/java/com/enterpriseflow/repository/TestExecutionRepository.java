package com.enterpriseflow.repository;
import com.enterpriseflow.entity.TestExecution;
import org.springframework.data.jpa.repository.JpaRepository;
public interface TestExecutionRepository extends JpaRepository<TestExecution,Long> {}
