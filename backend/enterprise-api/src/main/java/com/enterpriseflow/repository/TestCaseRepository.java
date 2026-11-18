package com.enterpriseflow.repository;
import com.enterpriseflow.entity.TestCase;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface TestCaseRepository extends JpaRepository<TestCase,Long> {
    Optional<TestCase> findByCaseId(String caseId);
}
