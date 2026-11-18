package tests;

import base.BaseTest;
import org.testng.Reporter;
import org.testng.annotations.Test;

public class LoginTest extends BaseTest {
    @Test
    public void validLoginDisplaysHRMSWorkspace() {
        String outcome = "failed";
        try {
            Reporter.log("Opening the configured HRMS login page.", true);
            openSampleApp();
            type("[data-testid='login-username']", "admin");
            type("[data-testid='login-password']", "Admin@123");
            click("[data-testid='login-submit']");
            Reporter.log("Login submitted; waiting for the Employees workspace.", true);
            waitForText("Employees");
            outcome = "passed";
            Reporter.log("Login passed: the Employees workspace is visible.", true);
        } finally {
            captureScreenshot("valid-login-" + outcome);
        }
    }
}
