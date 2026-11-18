package base;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Properties;
import org.openqa.selenium.By;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebDriverException;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Reporter;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

public class BaseTest {
    protected WebDriver driver;
    protected Properties config = new Properties();

    @BeforeMethod
    public void setUp() {
        loadConfig();
        String browser = System.getProperty("browser", config.getProperty("browser", "chrome")).trim();
        if (!"chrome".equalsIgnoreCase(browser)) {
            throw new IllegalArgumentException("The Selenium engine currently supports Chrome only.");
        }
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--window-size=1440,900");
        String headless = System.getProperty("headless", config.getProperty("headless", "true")).trim();
        if (!"true".equalsIgnoreCase(headless) && !"false".equalsIgnoreCase(headless)) {
            throw new IllegalArgumentException("The headless setting must be true or false.");
        }
        if (Boolean.parseBoolean(headless)) options.addArguments("--headless=new");
        driver = new ChromeDriver(options);
    }

    @AfterMethod
    public void tearDown() {
        if (driver == null) return;
        driver.quit();
        driver = null;
    }

    protected void captureScreenshot(String label) {
        if (driver == null) return;
        try {
            if (driver instanceof TakesScreenshot screenshotDriver) {
                String safeLabel = label.replaceAll("[^A-Za-z0-9._-]", "_");
                String fileName = safeLabel + "-" + System.currentTimeMillis() + ".png";
                Path screenshotDirectory = Path.of("target", "surefire-reports", "screenshots");
                Files.createDirectories(screenshotDirectory);
                Path screenshotPath = screenshotDirectory.resolve(fileName);
                Files.copy(screenshotDriver.getScreenshotAs(OutputType.FILE).toPath(), screenshotPath);
                Reporter.log("Screenshot: <a href=\"screenshots/" + fileName + "\">Open " + safeLabel + "</a>", true);
            } else {
                Reporter.log("The current WebDriver does not support screenshots.", true);
            }
        } catch (IOException | WebDriverException exception) {
            Reporter.log("Could not save test screenshot: " + exception.getMessage(), true);
        }
    }

    protected void openSampleApp() {
        driver.get(System.getProperty("baseUrl", config.getProperty("baseUrl", "http://localhost:5174")));
    }

    private void loadConfig() {
        config.clear();
        try (var input = BaseTest.class.getClassLoader().getResourceAsStream("config.properties")) {
            if (input == null) throw new IllegalStateException("Missing automation config.properties.");
            config.load(input);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not load automation config.properties.", exception);
        }
    }

    protected void type(String selector, String value) {
        var element = new WebDriverWait(driver, Duration.ofSeconds(10))
            .until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(selector)));
        element.clear();
        element.sendKeys(value);
    }
    protected void click(String selector) { new WebDriverWait(driver, Duration.ofSeconds(10)).until(ExpectedConditions.elementToBeClickable(By.cssSelector(selector))).click(); }
    protected void waitForText(String text) { new WebDriverWait(driver, Duration.ofSeconds(10)).until(ExpectedConditions.textToBePresentInElementLocated(By.tagName("body"), text)); }
}
