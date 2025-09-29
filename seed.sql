CREATE DATABASE IF NOT EXISTS reverse_vending;
USE reverse_vending;

CREATE TABLE IF NOT EXISTS Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    points INT DEFAULT 50
);

CREATE TABLE IF NOT EXISTS Rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cost INT NOT NULL
);

CREATE TABLE IF NOT EXISTS UserRewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    reward_id INT,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id),
    FOREIGN KEY (reward_id) REFERENCES Rewards(id)
);

INSERT INTO Rewards (name, description, cost) VALUES
('Notebook', 'College-ruled 100-page notebook', 20),
('Pen Set', 'Pack of 5 colorful pens', 15),
('Pencil Case', 'Durable pencil case', 25),
('Eraser', 'Set of 3 erasers', 10),
('Ruler', '12-inch transparent ruler', 15);