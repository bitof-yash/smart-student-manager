package com.studyos.analytics.repository;

import com.studyos.analytics.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<User, String> {
}
