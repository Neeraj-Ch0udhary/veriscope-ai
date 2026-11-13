# Sales dataset dictionary
revenue: total order value in INR, equal to units multiplied by unit_price. This is the main sales metric.
order_date: the date the order was placed.
category: product category. Values are Electronics, Clothing, Groceries and Furniture.
region: sales region. Values are North, South, East and West. A missing region means the order was not assigned to a region.
units: number of items in the order.
unit_price: price of one item in INR.
Business rule: a month-over-month revenue drop above 15 percent is significant and must be investigated by category and by region.
Business rule: a revenue value more than 10 times a typical order is probably a data-entry error and should be flagged as an outlier.