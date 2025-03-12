public class CircleDemo {
    // Circle class definition
    static class Circle {
        private double radius;
        private String color;
        
        // Constructor
        public Circle(double radius, String color) {
            this.radius = radius;
            this.color = color;
        }
        
        // Getters and setters
        public double getRadius() {
            return radius;
        }
        
        public void setRadius(double radius) {
            this.radius = radius;
        }
        
        public String getColor() {
            return color;
        }
        
        public void setColor(String color) {
            this.color = color;
        }
        
        // Calculate area
        public double calculateArea() {
            return Math.PI * radius * radius;
        }
        
        // Calculate circumference
        public double calculateCircumference() {
            return 2 * Math.PI * radius;
        }
        
        // Display circle information
        public void displayInfo() {
            System.out.println("Circle Information:");
            System.out.println("Radius: " + radius);
            System.out.println("Color: " + color);
            System.out.println("Area: " + calculateArea());
            System.out.println("Circumference: " + calculateCircumference());
        }
    }
    
    // Main method to demonstrate Circle class
    public static void main(String[] args) {
        // Create a few circle objects
        Circle circle1 = new Circle(5.0, "Red");
        Circle circle2 = new Circle(7.5, "Blue");
        
        // Display information about the circles
        System.out.println("Circle 1:");
        circle1.displayInfo();
        
        System.out.println("\nCircle 2:");
        circle2.displayInfo();
        
        // Modify circle1 and display again
        System.out.println("\nAfter modifying Circle 1:");
        circle1.setRadius(10.0);
        circle1.setColor("Green");
        circle1.displayInfo();
    }
} 