pipeline {
  agent any
  stages {
    stage('Backend') { steps { sh 'cd backend/enterprise-api && mvn clean test' } }
    stage('Automation') { steps { sh 'cd automation/selenium-engine && mvn test' } }
  }
  post { always { junit '**/target/surefire-reports/*.xml' } }
}
