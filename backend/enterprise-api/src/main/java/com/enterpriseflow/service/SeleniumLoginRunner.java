package com.enterpriseflow.service;

import com.enterpriseflow.entity.TestExecution;
import com.enterpriseflow.entity.TestResult;
import com.enterpriseflow.repository.TestExecutionRepository;
import com.enterpriseflow.repository.TestResultRepository;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.openqa.selenium.By;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebDriverException;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SeleniumLoginRunner {
    private static final String CASE_ID = "TC_AUTH_001";
    private static final String TEST_NAME = "Valid login";

    private final TestExecutionRepository executions;
    private final TestResultRepository results;
    private final String hrmsUrl;
    private final String username;
    private final String password;
    private final Path screenshotDirectory;
    private final ThreadPoolExecutor executor = new ThreadPoolExecutor(
        1, 1, 0, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(1),
        new ThreadPoolExecutor.AbortPolicy()
    );

    public SeleniumLoginRunner(
        TestExecutionRepository executions,
        TestResultRepository results,
        @Value("${enterpriseflow.hrms-url:http://localhost:5174}") String hrmsUrl,
        @Value("${enterpriseflow.hrms-username:admin}") String username,
        @Value("${enterpriseflow.hrms-password:Admin@123}") String password,
        @Value("${enterpriseflow.storage:./storage}") String storageDirectory
    ) {
        this.executions = executions;
        this.results = results;
        this.hrmsUrl = validateLocalUrl(hrmsUrl);
        this.username = username;
        this.password = password;
        this.screenshotDirectory = Path.of(storageDirectory).resolve("screenshots").toAbsolutePath().normalize();
    }

    public boolean submit(Long executionId) {
        try {
            executor.execute(() -> run(executionId));
            return true;
        } catch (RejectedExecutionException exception) {
            return false;
        }
    }

    private void run(Long executionId) {
        TestExecution execution = executions.findById(executionId).orElse(null);
        if (execution == null) return;

        Instant startedAt = execution.getStartedAt() == null ? Instant.now() : execution.getStartedAt();
        execution.setStatus("RUNNING");
        execution.setCurrentTest(CASE_ID + " - " + TEST_NAME);
        execution.setTotalTests(1);
        executions.save(execution);

        long startNanos = System.nanoTime();
        WebDriver driver = null;
        String failure = null;
        String screenshotPath = null;
        String screenshotFailure = null;
        try {
            ChromeOptions options = new ChromeOptions();
            options.addArguments("--window-size=1440,900", "--headless=new");
            driver = new ChromeDriver(options);
            driver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(20));
            driver.get(hrmsUrl);

            WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));
            var userField = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='login-username']")));
            userField.clear();
            userField.sendKeys(username);
            var passwordField = driver.findElement(By.cssSelector("[data-testid='login-password']"));
            passwordField.clear();
            passwordField.sendKeys(password);
            driver.findElement(By.cssSelector("[data-testid='login-submit']")).click();
            wait.until(ExpectedConditions.textToBePresentInElementLocated(By.tagName("body"), "Employees"));
        } catch (WebDriverException exception) {
            failure = summarize(exception);
        } finally {
            if (driver != null) {
                try {
                    screenshotPath = captureScreenshot(driver, executionId);
                } catch (IOException exception) {
                    screenshotFailure = exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
                } catch (WebDriverException exception) {
                    screenshotFailure = summarize(exception);
                }
                try {
                    driver.quit();
                } catch (WebDriverException exception) {
                    if (failure == null) failure = "Browser cleanup failed: " + summarize(exception);
                }
            }
        }

        final String failureMessage = failure;
        long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);
        TestResult result = new TestResult();
        result.setExecutionId(executionId);
        result.setCaseId(CASE_ID);
        result.setTestName(TEST_NAME);
        result.setModule("Authentication");
        result.setStatus(failureMessage == null ? "PASSED" : "FAILED");
        result.setDurationMs(durationMs);
        result.setErrorMessage(failureMessage);
        result.setScreenshotPath(screenshotPath);
        result.setLogs(failureMessage == null
            ? "Opened the configured HRMS login page and verified that the Employees workspace appears after sign-in."
            : "Selenium login check failed: " + failureMessage);
        if (screenshotFailure != null) result.setLogs(result.getLogs() + " Screenshot capture failed: " + screenshotFailure);
        results.save(result);

        executions.findById(executionId).ifPresent(current -> {
            current.setTotalTests(1);
            current.setPassedTests(failureMessage == null ? 1 : 0);
            current.setFailedTests(failureMessage == null ? 0 : 1);
            current.setSkippedTests(0);
            current.setCurrentTest(null);
            current.setStatus(failureMessage == null ? "COMPLETED" : "FAILED");
            current.setStartedAt(startedAt);
            current.setFinishedAt(Instant.now());
            current.setDurationMs(durationMs);
            executions.save(current);
        });
    }

    private String captureScreenshot(WebDriver driver, Long executionId) throws IOException {
        if (!(driver instanceof TakesScreenshot screenshotDriver)) return null;
        Files.createDirectories(screenshotDirectory);
        String fileName = "execution-" + executionId + "-" + System.currentTimeMillis() + ".png";
        Path screenshot = screenshotDirectory.resolve(fileName);
        Files.copy(screenshotDriver.getScreenshotAs(OutputType.FILE).toPath(), screenshot, StandardCopyOption.REPLACE_EXISTING);
        return Path.of("screenshots", fileName).toString().replace('\\', '/');
    }

    @PreDestroy
    public void shutdown() {
        executor.shutdownNow();
    }

    private String summarize(WebDriverException exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) return exception.getClass().getSimpleName();
        String firstLine = message.lines().findFirst().orElse(exception.getClass().getSimpleName());
        return firstLine.length() > 500 ? firstLine.substring(0, 500) : firstLine;
    }

    private String validateLocalUrl(String url) {
        URI uri = URI.create(url);
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (!("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
            || !("localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host))
            || uri.getUserInfo() != null) {
            throw new IllegalArgumentException("HRMS_URL must point to a local HTTP(S) host (localhost or 127.0.0.1).");
        }
        return uri.toString();
    }
}
