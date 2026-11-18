package com.enterpriseflow.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="test_suites")
public class TestSuite {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false) private String name;
    private String description;
    private String module;
    private boolean enabled = true;
    private Instant createdAt = Instant.now();

    public Long getId(){return id;} public void setId(Long id){this.id=id;}
    public String getName(){return name;} public void setName(String name){this.name=name;}
    public String getDescription(){return description;} public void setDescription(String description){this.description=description;}
    public String getModule(){return module;} public void setModule(String module){this.module=module;}
    public boolean isEnabled(){return enabled;} public void setEnabled(boolean enabled){this.enabled=enabled;}
    public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant createdAt){this.createdAt=createdAt;}
}
